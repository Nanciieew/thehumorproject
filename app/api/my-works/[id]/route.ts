import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/auth/server";
import { galleryWriter, galleryError } from "@/lib/gallery-http";
import { isUuid } from "@/lib/gallery-types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await galleryWriter(request); if (viewer instanceof Response) return viewer;
  const { id } = await params;
  if (!isUuid(id)) return galleryError(new Error("Work not found."), 404);
  let body; try { body = await request.json(); } catch { return galleryError(new Error("Invalid caption.")); }
  if (typeof body?.title !== "string" || typeof body?.description !== "string" || body.title.trim().length > 100 || body.description.trim().length > 1000) {
    return galleryError(new Error("Use up to 100 characters for the name and 1,000 for the description."));
  }
  const auth = await createAuthClient();
  const owned = await auth.from("images").select("id").eq("contributor_id", viewer.user.id).eq("id", id).maybeSingle();
  if (owned.error) return galleryError(new Error("Couldn’t check this work. Please try again."), 503);
  if (!owned.data) return galleryError(new Error("Work not found."), 404);
  const title = body.title.trim(); const description = body.description.trim();
  const result = await auth.rpc("save_work_caption", { p_work_id: id, p_title: title, p_description: description });
  if (result.error) return galleryError(new Error("Couldn’t save your captions. Please try again."), 503);
  revalidatePath("/my-works"); revalidatePath(`/my-works/${id}`); revalidatePath("/");
  return Response.json({ title, description }, { headers: { "Cache-Control": "no-store" } });
}
