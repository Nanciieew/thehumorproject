import { createAuthClient } from "@/lib/auth/server";
import { galleryError, galleryWriter } from "@/lib/gallery-http";
import { isUuid } from "@/lib/gallery-types";

export async function POST(request: Request) {
  const viewer = await galleryWriter(request); if (viewer instanceof Response) return viewer;
  let body; try { body = await request.json(); } catch { return galleryError(new Error("Invalid request.")); }
  if (!isUuid(body?.photoId) || ![1, -1, null].includes(body?.value)) return galleryError(new Error("Choose upvote, downvote, or no vote."));
  const auth = await createAuthClient();
  const saved = await auth.rpc("set_photo_vote", { p_photo_id: body.photoId, p_value: body.value });
  if (saved.error) return galleryError(new Error("Your vote couldn’t be saved. Please try again."));
  const score = await auth.rpc("gallery_photo_score", { p_photo_id: body.photoId });
  if (score.error || !score.data?.length) return galleryError(new Error("Your vote was saved, but counts couldn’t refresh. Please refresh the gallery."), 503);
  return Response.json({ vote: body.value, upvotes: Number(score.data[0].upvotes) }, { headers: { "Cache-Control": "no-store" } });
}
