import "server-only";
import { supabase } from "./supabase";
import { profilePhotoUrl } from "./profile-photo";
import { US_STATES } from "./us-states";
import { decodeLeaderboardCursor, type LeaderboardAvatar, type LeaderboardIndividual, type LeaderboardPeriod, type LeaderboardSummary } from "./leaderboard-types";

type IndividualRow = Omit<LeaderboardIndividual, "profile_photo_url"> & { avatar_path: string | null };
type AvatarRow = Omit<LeaderboardAvatar, "profile_photo_url" | "photo_url"> & { avatar_path: string | null; public_storage_path: string };
type SummaryRow = Omit<LeaderboardSummary, "individuals" | "podium" | "monthly_top_avatars" | "monthly_top_regions" | "next_cursor"> & {
  individuals: IndividualRow[]; podium: IndividualRow[]; monthly_top_avatars: AvatarRow[];
  monthly_top_regions: Omit<LeaderboardSummary["monthly_top_regions"][number], "state_name">[];
  next_cursor: unknown;
};

// Caller must verify completed onboarding. Raw transaction data never leaves this helper.
export async function readLeaderboard(period: LeaderboardPeriod, cursor: string | null = null): Promise<LeaderboardSummary> {
  const decoded = decodeLeaderboardCursor(cursor, period);
  const { data, error } = await supabase.rpc("leaderboard_summary", { p_period: period, p_cursor: decoded, p_limit: 30 });
  if (error) throw new Error("Couldn’t load the leaderboard. Please try again.");
  const row = data as SummaryRow;
  const photos = new Map<string, Promise<string | null>>();
  const photo = (path: string | null) => {
    if (!path) return Promise.resolve(null);
    if (!photos.has(path)) photos.set(path, profilePhotoUrl(path).catch(() => null));
    return photos.get(path)!;
  };
  const individual = async ({ avatar_path, ...item }: IndividualRow): Promise<LeaderboardIndividual> => ({
    ...item, profile_photo_url: await photo(avatar_path), revenue_cents: String(item.revenue_cents),
    rank: Number(item.rank), avatars_made: Number(item.avatars_made), total_votes: Number(item.total_votes),
  });
  return {
    ...row,
    individuals: await Promise.all(row.individuals.map(individual)),
    podium: await Promise.all(row.podium.map(individual)),
    monthly_top_avatars: await Promise.all(row.monthly_top_avatars.map(async ({ avatar_path, public_storage_path, ...item }) => ({
      ...item, upvotes: Number(item.upvotes), profile_photo_url: await photo(avatar_path),
      photo_url: supabase.storage.from("gallery-photos").getPublicUrl(public_storage_path).data.publicUrl,
    }))),
    monthly_top_regions: row.monthly_top_regions.map(item => ({ ...item,
      avatars_contributed: Number(item.avatars_contributed), revenue_cents: String(item.revenue_cents),
      state_name: US_STATES.find(([code]) => code === item.state_code)?.[1] ?? item.state_code,
    })),
    next_cursor: row.next_cursor ? Buffer.from(JSON.stringify(row.next_cursor)).toString("base64url") : null,
  };
}
