import Link from "next/link";
import { getViewer } from "@/lib/auth/profile";
import { egoRead } from "@/lib/ego/server";
import type { Battle } from "@/lib/ego/types";
import { isUuid } from "@/lib/gallery-types";
import { notFound } from "next/navigation";
import { BattleView } from "./view";
export const metadata = { title: "Battle | checked" };
export default async function BattlePage({ params }: { params: Promise<{ id: string }> }) {
  const {id}=await params; if(!isUuid(id)) notFound(); const viewer=await getViewer();
  const battle = await egoRead<Battle>("battle",{id}).catch(() => null);
  if (battle) return <BattleView initial={battle} userId={viewer?.user.id??null} />;
  return <main id="main" className="ego-page"><section className="ego-panel"><h1>Behind closed egos.</h1><p>This invitation may be private, expired, or unavailable to your account.</p>{!viewer&&<Link className="ego-button" href={`/login?next=${encodeURIComponent(`/challenges/${id}`)}`}>Sign in to open invitation</Link>}<Link href="/challenges" className="ego-link">Back to The Arena →</Link></section></main>;
}
