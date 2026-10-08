import { after } from "next/server";
import { readGallery, GalleryCursorExpired } from "@/lib/gallery";
import { cleanupGalleryStaging } from "@/lib/gallery-media";
import { isGallerySort } from "@/lib/gallery-types";
import { galleryError } from "@/lib/gallery-http";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sort = params.get("sort") ?? "top";
  if (!isGallerySort(sort)) return Response.json({ error: "Choose a valid gallery filter." }, { status: 400 });
  after(cleanupGalleryStaging);
  try { return Response.json(await readGallery(sort, params.get("cursor")), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) {
    if (error instanceof GalleryCursorExpired) return Response.json({ error: error.message, code: "GALLERY_CURSOR_EXPIRED" }, { status: 409 });
    return galleryError(error);
  }
}
