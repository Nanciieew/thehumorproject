import { revalidatePath } from "next/cache";
import { galleryWriter } from "@/lib/gallery-http";
import { publishRoast } from "@/lib/roast/publication";
import { readBoundedJson } from "@/lib/roast/read-body";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  const viewer = await galleryWriter(request); if (viewer instanceof Response) return viewer;
  try {
    const body = await readBoundedJson(request, 14 * 1024 * 1024);
    const photoId = await publishRoast(viewer.user.id, body);
    revalidatePath("/gallery"); revalidatePath("/my-works");
    return Response.json({ photoId }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Couldn’t publish your ego. Please try again." }, { status: 400, headers });
  }
}
