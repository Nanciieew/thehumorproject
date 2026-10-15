import { egoRead } from "@/lib/ego/server";
import type { Rankings } from "@/lib/ego/types";
import { ShameBoard } from "./shame-board";
export const metadata = { title: "Hall of Shame | Ego Check" };
export default async function LeaderboardPage() {
  let initial: Rankings | null = null; let error = "";
  try { initial = await egoRead<Rankings>("rankings"); } catch(e) { error = e instanceof Error ? e.message : "Rankings unavailable."; }
  return <ShameBoard initial={initial} initialError={error}/>;
}
