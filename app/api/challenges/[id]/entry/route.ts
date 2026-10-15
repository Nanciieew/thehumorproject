import { createHash } from "node:crypto";
import sharp from "sharp";
import { getViewer } from "@/lib/auth/profile";
import { egoRead, egoServer, noStore } from "@/lib/ego/server";
import type { Battle } from "@/lib/ego/types";
import { supabase } from "@/lib/supabase";
import { readBoundedJson } from "@/lib/roast/read-body";
import { verifyReceipt } from "@/lib/roast/receipt";
import { isUuid } from "@/lib/gallery-types";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const viewer = await getViewer(); if (!viewer) return Response.json({ error: "Sign in to submit an entry." }, { status: 401 });
  const { id } = await params;
  let uploaded = false; const path = `${viewer.user.id}/${id}.webp`;
  try {
    if (!isUuid(id)) throw new Error("Invalid challenge.");
    const body = await readBoundedJson(request, 300000) as { receipt: string; snapshot: string; approved: boolean };
    if (body.approved !== true || typeof body.snapshot !== "string" || body.snapshot.length > 273068) throw new Error("Approve the snapshot and audience first.");
    const roast = verifyReceipt(body.receipt, viewer.user.id, body.snapshot);
    const battle = await egoRead<Battle>("battle", { id });
    if (![battle.creatorId, battle.opponentId].includes(viewer.user.id) || !(battle.status === "preparing" || (battle.status === "invited" && battle.creatorId === viewer.user.id))) throw new Error("This challenge is not accepting entries.");
    if (battle.entries.some(e => e.userId === viewer.user.id)) return Response.json({ ok: true }, { headers: noStore });
    const bytes = Buffer.from(body.snapshot, "base64");
    const image = sharp(bytes, { limitInputPixels: 640 * 640 }); const meta = await image.metadata();
    if (meta.format !== "jpeg" || !meta.width || !meta.height || Math.max(meta.width, meta.height) > 640) throw new Error("Invalid snapshot.");
    const webp = await image.webp({ quality: 80 }).toBuffer(); if (webp.length > 204800) throw new Error("Snapshot too large.");
    const saved = await supabase.storage.from("challenge-entries").upload(path, webp, { contentType: "image/webp", upsert: false });
    if (saved.error) throw new Error("Could not save your entry. Refresh before trying again."); uploaded = true;
    await egoServer(viewer.user.id, "entry", { id, roast, path, receipt: createHash("sha256").update(body.receipt).digest("hex") });
    return Response.json({ ok: true }, { headers: noStore });
  } catch (e) {
    if (uploaded) await supabase.storage.from("challenge-entries").remove([path]);
    return Response.json({ error: e instanceof Error ? e.message : "Entry unavailable." }, { status: 400, headers: noStore });
  }
}
