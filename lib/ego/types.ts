export type Visibility = "public" | "friends" | "private";
export type Friend = { id: string; user_id: string; name: string; status: "pending" | "accepted"; incoming: boolean };
export type Person = { id: string; name: string };
export type BattleEntry = { userId: string; roast: string | null; hasMedia: boolean; publishedId: string | null };
export type Battle = { id: string; creatorId: string; opponentId: string | null; creator: string; opponent: string; status: "invited" | "preparing" | "voting" | "completed" | "cancelled" | "declined" | "expired"; visibility: Visibility; endsAt: string | null; expiresAt: string; winner: string | null; creatorVotes: number; opponentVotes: number; myVote: string | null; entries: BattleEntry[] };
export type ArenaItem = Pick<Battle, "id" | "creator" | "opponent" | "status" | "visibility" | "endsAt" | "creatorVotes" | "opponentVotes" | "creatorId" | "opponentId" | "entries">;
export type Rankings = { trackingStartedAt: string; weekly: { id: string; name: string; wins: number; votes: number }[]; monthly: { id: string; title: string; name: string; public_storage_path: string; votes: number; lifetime_votes: number }[] };
export type CompetitionSummary = { wins: number; active: number; invitations: number };
