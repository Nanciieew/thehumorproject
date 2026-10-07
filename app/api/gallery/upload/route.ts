import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { supabase } from "@/lib/supabase";
import { galleryError, galleryWriter } from "@/lib/gallery-http";
import { cleanupGalleryStaging } from "@/lib/gallery-media";
import { GALLERY_MIME_TYPES, MAX_GALLERY_BYTES } from "@/lib/gallery-types";

export async function POST(request: Request) {
  const viewer = await galleryWriter(request); if (viewer instanceof Response) return viewer;
  let body; try { body = await request.json(); } catch { return galleryError(new Error("Invalid upload request.")); }
  if (!GALLERY_MIME_TYPES.includes(body?.type) || !Number.isInteger(body?.size) || body.size <= 0 || body.size > MAX_GALLERY_BYTES) {
    return galleryError(new Error("Choose a JPG, PNG, or WebP photo up to 10 MB."));
  }
  after(cleanupGalleryStaging);
  const id = randomUUID(); const path = `${viewer.user.id}/${id}`;
  const row = await supabase.from("gallery_uploads").insert({ id, contributor_id: viewer.user.id, storage_path: path });
  if (row.error) return galleryError(new Error("Couldn’t start your upload. Please try again."), 503);
  const signed = await supabase.storage.from("gallery-staging").createSignedUploadUrl(path);
  if (signed.error) { await supabase.from("gallery_uploads").delete().eq("id", id); return galleryError(new Error("Couldn’t start your upload. Please try again."), 503); }
  return Response.json({ uploadId: id, signedUrl: signed.data.signedUrl }, { headers: { "Cache-Control": "no-store" } });
}
