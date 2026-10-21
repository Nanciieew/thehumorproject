"use client";
import Link from "next/link";
import { useState } from "react";
import { ego } from "@/lib/ego/client";
import type { Rankings } from "@/lib/ego/types";
export function ShameBoard({ initial, initialError }: { initial: Rankings | null; initialError: string }) {
 const [data,setData]=useState(initial);const [tab,setTab]=useState("weekly");const [error,setError]=useState(initialError);const [busy,setBusy]=useState(false);
 async function refresh(){setBusy(true);setError("");try{setData(await ego<Rankings>("rankings"));}catch(e){setError(e instanceof Error?e.message:"Rankings unavailable.");}finally{setBusy(false);}}
 return <main id="main" className="ego-page"><header className="ego-hero"><h1>Hall of Shame.</h1></header>
 <div className="ego-tabs" role="group" aria-label="Ranking type"><button aria-pressed={tab==="weekly"} onClick={()=>setTab("weekly")}>Weekly wins</button><button aria-pressed={tab==="monthly"} onClick={()=>setTab("monthly")}>Monthly upvotes</button><button disabled={busy} onClick={()=>void refresh()}>{busy?"Refreshing…":"Refresh"}</button></div>
 {error&&<p role="alert" className="ego-panel">{error}</p>}
 <section className="ego-panel">
 {tab==="weekly"?<><details className="ego-details"><summary>Ranking rules</summary><p>Public wins this week, Monday–Sunday in New York time. Minimum 3 spectator votes; one win per opponent per week. Top 50.</p></details>{!data?<p>Rankings are unavailable. Try Refresh.</p>:!data.weekly.length?<p>Nobody’s embarrassing enough. Yet.</p>:<div className="ego-scroll"><table className="ego-rank-table"><thead><tr><th>Rank</th><th>Person responsible</th><th>Wins</th><th>Battle votes</th></tr></thead><tbody>{data.weekly.map((p,i)=><tr key={p.id}><td>{String(i+1).padStart(2,"0")}</td><td>{p.name}</td><td>{p.wins}</td><td>{p.votes}</td></tr>)}</tbody></table></div>}</>:<><details className="ego-details"><summary>Ranking rules</summary><p>New, active upvotes this month, including older cards. Gallery votes don’t change battle results.</p>{data&&<p className="ego-note">Tracking began {new Date(data.trackingStartedAt).toLocaleDateString("en-US", { timeZone: "America/New_York" })}; earlier dates are unavailable.</p>}</details>{!data?<p>Rankings are unavailable. Try Refresh.</p>:!data.monthly.length?<p>No fresh evidence. Suspicious.</p>:<div className="ego-scroll"><table className="ego-rank-table"><thead><tr><th>Rank</th><th>Evidence</th><th>Person responsible</th><th>New upvotes</th><th>Lifetime upvotes</th></tr></thead><tbody>{data.monthly.map((p,i)=><tr key={p.id}><td>{String(i+1).padStart(2,"0")}</td><td><Link href={`/gallery#photo-${p.id}`}>{p.title||"Evidence on file"}</Link></td><td>{p.name}</td><td>{p.votes}</td><td>{p.lifetime_votes}</td></tr>)}</tbody></table></div>}</>}
 </section><Link href="/challenges" className="ego-button">Enter The Arena ↗</Link></main>;
}
