import { getViewer } from "@/lib/auth/profile";
import { egoRead } from "@/lib/ego/server";
import type { ArenaItem } from "@/lib/ego/types";
import { Arena } from "./arena";
export const metadata = { title: "The Arena | Ego Check" };
export default async function ArenaPage({ searchParams }: { searchParams: Promise<{scope?: string}> }) {
  const viewer = await getViewer(); const scope = viewer && (await searchParams).scope === "mine" ? "mine" : "public"; let items: ArenaItem[] = []; let error = "";
  try { items = await egoRead<ArenaItem[]>("arena", { scope }); } catch (e) { error = e instanceof Error ? e.message : "The Arena couldn’t load."; }
  return <Arena initialScope={scope} initial={items} initialError={error} signedIn={!!viewer} />;
}
