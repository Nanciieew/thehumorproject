import type { Metadata } from "next";
import { LeaderboardPreview } from "./preview";
export const metadata: Metadata = { title: "Leaderboard design preview | Ego Check", robots: { index: false, follow: false } };
export default function Page() { return <LeaderboardPreview />; }
