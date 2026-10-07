import { galleryError, galleryWriter } from "@/lib/gallery-http";
import { publishGalleryImage } from "@/lib/gallery-media";
import { isUuid } from "@/lib/gallery-types";

export const maxDuration = 60;
export async function POST(request: Request) {
  const viewer = await galleryWriter(request); if (viewer instanceof Response) return viewer;
  let body; try { body = await request.json(); } catch { return galleryError(new Error("Invalid publication request.")); }
  if (!isUuid(body?.assetId) || !["upload", "generated"].includes(body?.source)) return galleryError(new Error("Choose an image to publish."));
  try { return Response.json({ photoId: await publishGalleryImage(viewer.user.id, body.assetId, body.source) }); }
  catch (error) { return galleryError(error); }
}
