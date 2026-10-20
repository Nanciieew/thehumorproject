import { getViewer } from "@/lib/auth/profile";
import { readWorks } from "@/lib/works";
import { galleryError } from "@/lib/gallery-http";

export async function GET(request: Request) {
  if (!await getViewer()) return Response.json({ error: "Please log in and finish signup." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const sort = params.get("sort") ?? "top";
  if (sort !== "top" && sort !== "newest") return galleryError(new Error("Choose most votes or newest."));
  try { return Response.json(await readWorks(params.get("cursor"), sort), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return galleryError(error); }
}
