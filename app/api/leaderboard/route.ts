import { getViewer } from "@/lib/auth/profile";
import { readLeaderboard } from "@/lib/leaderboard";
import { InvalidLeaderboardCursor, isLeaderboardPeriod } from "@/lib/leaderboard-types";

export async function GET(request: Request) {
  if (!await getViewer()) return Response.json({ error: "Please log in and finish signup." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const period = params.get("period") ?? "monthly";
  if (!isLeaderboardPeriod(period)) return Response.json({ error: "Choose monthly or all_time." }, { status: 400 });
  try {
    return Response.json(await readLeaderboard(period, params.get("cursor")), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Couldn’t load the leaderboard." }, {
      status: error instanceof InvalidLeaderboardCursor ? 400 : 503, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
