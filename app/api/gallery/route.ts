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
  try {
    const search = (params.get("search") ?? "").trim().toLocaleLowerCase();
    if (search.length > 120) return Response.json({ error: "Use an avatar name up to 120 characters." }, { status: 400 });
    let cursor = params.get("cursor");
    // Search successive ranked pages, retaining the feed cursor and sort order.
    // Bound each request so sparse matches can continue through infinite scrolling.
    for (let scanned = 0; scanned < 5; scanned++) {
      const page = await readGallery(sort, cursor);
      if (search) page.items = page.items.filter((photo) => (photo.title || photo.contributor_name).toLocaleLowerCase().includes(search));
      if (page.items.length || !page.next_cursor || scanned === 4) {
        return Response.json(page, { headers: { "Cache-Control": "private, no-store" } });
      }
      cursor = page.next_cursor;
    }
  }
  catch (error) {
    if (error instanceof GalleryCursorExpired) return Response.json({ error: error.message, code: "GALLERY_CURSOR_EXPIRED" }, { status: 409 });
    return galleryError(error);
  }
}
