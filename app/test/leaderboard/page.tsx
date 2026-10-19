import type { Metadata } from "next";
import { LeaderboardPreview } from "./preview";
export const metadata: Metadata = { title: "Leaderboard design preview | checked", robots: { index: false, follow: false } };
export default function Page() { return <LeaderboardPreview />; }
