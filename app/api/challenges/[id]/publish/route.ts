import { randomUUID } from "node:crypto";
import { getViewer } from "@/lib/auth/profile";
import { egoServer, noStore } from "@/lib/ego/server";
import { supabase } from "@/lib/supabase";
import { isUuid } from "@/lib/gallery-types";
import { readBoundedJson } from "@/lib/roast/read-body";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const viewer = await getViewer(); if (!viewer) return new Response(null, { status: 401 });
  const { id } = await params; if (!isUuid(id)) return new Response(null, { status: 400 });
  const token = randomUUID();
  const lease = await supabase.rpc("ego_publication_lease", { p_user: viewer.user.id, p_challenge: id, p_token: token, p_release: false });
  if (lease.error || !lease.data) return Response.json({ error: "This result is busy or unavailable. Refresh before trying again." }, { status: 409, headers: noStore });
  try {
    const body = await readBoundedJson(request, 256) as { unpublish?: boolean; approved?: boolean };
    const target = `${viewer.user.id}/challenge-${id}.webp`;
    if (body.unpublish) {
      await egoServer(viewer.user.id, "unpublish", { id });
      await supabase.storage.from("gallery-photos").remove([target]);
      return Response.json({ ok: true }, { headers: noStore });
    }
    if (body.approved !== true) throw new Error("Approve public sharing first.");
    const info = await egoServer<{ path: string | null; imageId: string | null }>(viewer.user.id, "publish_info", { id });
    if (info?.imageId) return Response.json({ imageId: info.imageId }, { headers: noStore });
    if (!info?.path) throw new Error("This snapshot has expired.");
    const file = await supabase.storage.from("challenge-entries").download(info.path);
    if (file.error) throw new Error("This snapshot is unavailable.");
    const upload = await supabase.storage.from("gallery-photos").upload(target, file.data, { contentType: "image/webp", cacheControl: "0", upsert: true });
    if (upload.error) throw new Error("Could not publish your snapshot.");
    const result = await egoServer(viewer.user.id, "publish", { id });
    return Response.json(result, { headers: noStore });
  } catch (e) { return Response.json({ error: e instanceof Error ? e.message : "Publication unavailable." }, { status: 400, headers: noStore }); }
  finally { await supabase.rpc("ego_publication_lease", { p_user: viewer.user.id, p_challenge: id, p_token: token, p_release: true }); }
}
