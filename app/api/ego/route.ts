import { egoRead, noStore } from "@/lib/ego/server";
import { readBoundedJson } from "@/lib/roast/read-body";
const actions = new Set(["search_people", "friends", "friend_request", "friend_accept", "friend_remove", "create", "accept", "arena", "battle", "vote", "cancel", "decline", "rankings", "summary"]);
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid origin." }, { status: 403 });
  try {
    const body = await readBoundedJson(request, 4096) as { action?: string; data?: object };
    if (!body || !actions.has(body.action ?? "") || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) return Response.json({ error: "Invalid request." }, { status: 400 });
    return Response.json(await egoRead(body.action!, body.data), { headers: noStore });
  } catch (e) { return Response.json({ error: e instanceof Error ? e.message : "Action unavailable." }, { status: 400, headers: noStore }); }
}
