import "server-only";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { supabase } from "@/lib/supabase";
import { verifyReceipt } from "./receipt";

export async function publishRoast(userId: string, input: unknown) {
  const body = input as { approved?: boolean; receipt?: string; snapshot?: string } | null;
  if (body?.approved !== true) throw new Error("Confirm public sharing first.");
  if (typeof body.receipt !== "string" || typeof body.snapshot !== "string" || !body.snapshot.length || body.snapshot.length > 273068 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.snapshot)) throw new Error("Choose a completed live roast to publish.");
  const roast = verifyReceipt(body.receipt, userId, body.snapshot);
  // A receipt always maps to one gallery card, across retries and server instances.
  const hash = createHash("sha256").update(`ego-check:solo-roast:v1:${userId}:${body.receipt}`).digest();
  hash[6] = (hash[6] & 15) | 128; hash[8] = (hash[8] & 63) | 128;
  const hex = hash.subarray(0, 16).toString("hex");
  const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  const existing = () => supabase.from("images").select("id,public_storage_path,published_at").eq("id", id).eq("contributor_id", userId).maybeSingle();
  const prior = await existing();
  if (prior.error) throw new Error("Couldn’t check this publication. Please try again.");
  if (prior.data?.published_at) return id;
  const bytes = Buffer.from(body.snapshot, "base64");
  if (bytes.length > 204800) throw new Error("Snapshot too large.");
  const image = sharp(bytes, { limitInputPixels: 640 * 640 });
  const meta = await image.metadata();
  if (meta.format !== "jpeg" || !meta.width || !meta.height || Math.max(meta.width, meta.height) > 640) throw new Error("Invalid roast snapshot.");
  const webp = await image.rotate().webp({ quality: 80 }).toBuffer();
  if (webp.length > 204800) throw new Error("Snapshot too large.");
  // Each attempt owns its object; a losing insert never removes a winner's media.
  const path = `${userId}/roast-${id}-${randomUUID()}.webp`;
  const bucket = supabase.storage.from("gallery-photos");
  const uploaded = await bucket.upload(path, webp, { contentType: "image/webp", cacheControl: "0" });
  if (uploaded.error) throw new Error("Couldn’t upload your ego. Please try again.");
  const saved = await supabase.from("images").insert({ id, contributor_id: userId, source: "upload", public_storage_path: path, title: "Ego checked.", description: roast, published_at: new Date().toISOString() }).select("id").single();
  if (!saved.error && saved.data) return id;
  const winner = await existing();
  // An uncertain write may have committed: retain its media until a retry can check.
  if (winner.error) throw new Error("Couldn’t confirm publication. Please try again.");
  if (winner.data?.public_storage_path !== path) await bucket.remove([path]);
  if (!winner.data?.published_at) throw new Error("Couldn’t publish your ego. Please try again.");
  return id;
}
