"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { battleTime } from "@/lib/ego/time";
import { ego } from "@/lib/ego/client";
import type { ArenaItem } from "@/lib/ego/types";
import { ChallengeCreator } from "../ego-ui";
export function Arena({ initial, initialError, signedIn, initialScope }: { initial: ArenaItem[]; initialError: string; signedIn: boolean; initialScope: string }) {
  const [items,setItems]=useState(initial); const [scope,setScope]=useState(initialScope); const [error,setError]=useState(initialError); const [busy,setBusy]=useState(false);
  async function load(next: string, more=false) { setBusy(true);setError("");try { const rows=await ego<ArenaItem[]>("arena",{scope:next,offset:more?items.length:0});setItems(old=>more?[...old,...rows.filter(x=>!old.some(y=>y.id===x.id))]:rows);setScope(next); } catch(e){setError(e instanceof Error?e.message:"Could not load battles.");}finally{setBusy(false);} }
  return <main id="main" className="ego-page"><header className="ego-hero"><p className="eyebrow">THE ARENA / PUBLIC OPINION, PRIVATE REGRET</p><h1>Who got<br /><em>cooked harder?</em></h1><p>Two egos enter. The comments aren’t necessary. Your vote is.</p></header>
    <div className="ego-tabs" role="group" aria-label="Battle feed"><button aria-pressed={scope==="public"} disabled={busy} onClick={()=>void load("public")}>Public battles</button>{signedIn&&<button aria-pressed={scope==="mine"} disabled={busy} onClick={()=>void load("mine")}>My challenges</button>}<button disabled={busy} onClick={()=>void load(scope)}>Refresh</button></div>
    {error&&<p role="alert" className="ego-panel">{error}<button onClick={()=>void load(scope)}>Try again</button></p>}
    {!items.length&&!error&&<div className="ego-panel"><h2>Suspiciously peaceful.</h2><p>No battles here yet. Be the problem.</p></div>}
    <div className="ego-card-grid">{items.map(b=><Link key={b.id} className="ego-panel battle-preview" href={`/challenges/${b.id}`}><span className="ego-stamp">{b.status}</span><h2>{b.creator}<small>VS</small>{b.opponent||"YOUR NEXT BAD INFLUENCE"}</h2><div className="arena-evidence">{b.entries.map(e=><div key={e.userId}>{e.hasMedia&&<Image src={`/api/challenges/${b.id}/media/${e.userId}`} width={240} height={180} unoptimized alt="Participant-approved battle snapshot" />}{e.roast&&<blockquote>{e.roast}</blockquote>}</div>)}</div><p>{b.visibility==="public"?"Public":b.visibility==="friends"?"Friends only":"Challengers only"}{b.endsAt?` · Voting closes ${battleTime(b.endsAt)}`:""}</p><strong>{b.status==="completed"?`${b.creatorVotes} : ${b.opponentVotes} · View verdict →`:"Open battle →"}</strong></Link>)}</div>
    {items.length>=60&&<button className="ego-button secondary" disabled={busy} onClick={()=>void load(scope,true)}>Load more battles</button>}
    {signedIn?<ChallengeCreator />:<Link className="ego-button" href="/login">Sign in to vote or challenge ↗</Link>}
  </main>;
}
