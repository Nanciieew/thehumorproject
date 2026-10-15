import { getViewer } from "@/lib/auth/profile";
import { egoServer, noStore } from "@/lib/ego/server";
import { supabase } from "@/lib/supabase";
import { isUuid } from "@/lib/gallery-types";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; user: string }> }) {
  const { id, user } = await params; if (!isUuid(id) || !isUuid(user)) return new Response(null, { status: 404 });
  try {
    const viewer = await getViewer();
    const result = await egoServer<{ path: string | null } | null>(viewer?.user.id ?? null, "media", { id, userId: user });
    if (!result?.path) return new Response(null, { status: 404 });
    const file = await supabase.storage.from("challenge-entries").download(result.path);
    if (file.error) return new Response(null, { status: 404 });
    return new Response(file.data, { headers: { ...noStore, "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response(null, { status: 404 }); }
}
