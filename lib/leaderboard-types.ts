export type LeaderboardPeriod = "monthly" | "all_time";
export type LeaderboardIndividual = {
  rank: number; contributor_id: string; name: string; profile_photo_url: string | null;
  avatars_made: number; total_votes: number; revenue_cents: string;
};
export type LeaderboardAvatar = {
  rank: number; id: string; contributor_id: string; name: string; profile_photo_url: string | null;
  title: string; photo_url: string; upvotes: number;
};
export type LeaderboardRegion = {
  rank: number; state_code: string; state_name: string; avatars_contributed: number; revenue_cents: string;
};
export type LeaderboardSummary = {
  period: LeaderboardPeriod; as_of: string; month_start: string; month_end: string;
  individuals: LeaderboardIndividual[]; podium: LeaderboardIndividual[];
  monthly_top_avatars: LeaderboardAvatar[]; monthly_top_regions: LeaderboardRegion[];
  monthly_rewards: { rank: number; credits: number }[]; next_cursor: string | null;
};
export function isLeaderboardPeriod(value: unknown): value is LeaderboardPeriod {
  return value === "monthly" || value === "all_time";
}
export class InvalidLeaderboardCursor extends Error {}
export function decodeLeaderboardCursor(cursor: string | null, period: LeaderboardPeriod) {
  if (!cursor) return null;
  try {
    if (cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString());
    if (value?.period !== period || !Number.isSafeInteger(value.rank) || value.rank < 0 ||
      typeof value.as_of !== "string" || !/^\d{4}-\d{2}-\d{2}T[\d:.+-]+(?:Z|[+-]\d{2}:\d{2})$/.test(value.as_of) || !Number.isFinite(Date.parse(value.as_of)) || Date.parse(value.as_of) > Date.now()) throw new Error();
    return { period, rank: value.rank, as_of: value.as_of };
  } catch { throw new InvalidLeaderboardCursor("Invalid leaderboard cursor. Please reload the leaderboard."); }
}
