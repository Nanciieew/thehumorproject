import { getViewer } from "@/lib/auth/profile";
import { readWorks } from "@/lib/works";
import { galleryError } from "@/lib/gallery-http";

export async function GET(request: Request) {
  if (!await getViewer()) return Response.json({ error: "Please log in and finish signup." }, { status: 401 });
  try { return Response.json(await readWorks(new URL(request.url).searchParams.get("cursor")), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return galleryError(error); }
}
