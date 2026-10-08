import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { readLeaderboard } from "@/lib/leaderboard";
import { Leaderboard } from "./leaderboard";

export const metadata: Metadata = { title: "Leaderboard | The Humor Project" };

export default async function LeaderboardPage() {
  if (!await getViewer()) redirect("/login");
  const initial = await readLeaderboard("monthly").catch(() => null);
  return <Leaderboard initial={initial} />;
}
