import { getViewer } from "@/lib/auth/profile";
import { resetSharedSession } from "@/lib/roast/shared-store";
import { readBoundedJson } from "@/lib/roast/read-body";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const viewer = await getViewer(); if (!viewer) return new Response(null, { status: 401 });
  try {
    const body = await readBoundedJson(request, 256) as { sessionId?: unknown };
    const sessionId = body?.sessionId;
    if (typeof sessionId !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(sessionId)) throw new Error();
    await resetSharedSession(viewer.user.id, sessionId);
  } catch { return new Response(null, { status: 400 }); }
  return new Response(null, { status: 204 });
}
