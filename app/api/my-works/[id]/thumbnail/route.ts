import { getViewer } from "@/lib/auth/profile";
import { workThumbnail } from "@/lib/work-thumbnail";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  const { id } = await params;
  const width = Number(new URL(request.url).searchParams.get("w") ?? "640");
  return workThumbnail(viewer?.user.id ?? null, id, width);
}
