import "server-only";
import { supabase } from "./supabase";

export type ReceivedVotes = { upvotes: string; downvotes: string };

// IDs are supplied only from authenticated, contributor-scoped image queries.
export async function readReceivedVotes(ids: string[]): Promise<Record<string, ReceivedVotes>> {
  if (!ids.length) return {};
  const totals = await supabase.from("gallery_vote_totals").select("photo_id,upvotes,downvotes").in("photo_id", ids);
  if (totals.error) throw new Error("Couldn’t load received votes. Please try again.");
  return Object.fromEntries((totals.data ?? []).map(row => [row.photo_id, { upvotes: String(row.upvotes), downvotes: String(row.downvotes) }]));
}

export async function readCheckboardTotals(contributorId: string): Promise<ReceivedVotes> {
  let cursor: string | null = null;
  let upvotes = BigInt(0), downvotes = BigInt(0);
  const asOf = new Date().toISOString();
  while (true) {
    let query = supabase.from("images").select("id").eq("contributor_id", contributorId)
      .not("published_at", "is", null).lte("published_at", asOf).order("id").limit(250);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query;
    if (error) throw new Error("Couldn’t load received votes. Please try again.");
    if (!data.length) break;
    const totals = await readReceivedVotes(data.map(row => row.id));
    for (const count of Object.values(totals)) { upvotes += BigInt(count.upvotes); downvotes += BigInt(count.downvotes); }
    cursor = data[data.length - 1].id;
    if (data.length < 250) break;
  }
  return { upvotes: upvotes.toString(), downvotes: downvotes.toString() };
}
