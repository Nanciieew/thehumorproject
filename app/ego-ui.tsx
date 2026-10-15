"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ego } from "@/lib/ego/client";
import type { Friend, Visibility } from "@/lib/ego/types";
export function ShareLink({ path, label = "Copy invitation" }: { path: string; label?: string }) {
  const [message, setMessage] = useState("");
  async function share() {
    const url = new URL(path, window.location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: "Ego Check", text: "I got checked. Your ego is next.", url });
      else { await navigator.clipboard.writeText(url); setMessage("Invitation copied. Send it to someone who needs this."); }
    } catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setMessage(`Share this link: ${url}`); }
  }
  return <div><button className="ego-button secondary" onClick={() => void share()}>{label} ↗</button>{message && <p role="status">{message}</p>}</div>;
}
export function ChallengeCreator({ onCreated }: { onCreated?: (id: string) => void }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [opponent, setOpponent] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [created, setCreated] = useState("");
  useEffect(() => { let current = true; void ego<Friend[]>("friends").then(r => { if (current) setFriends(r.filter(f => f.status === "accepted")); }).catch(() => {}); return () => { current = false; }; }, []);
  async function create() {
    setBusy(true); setError("");
    try { const result = await ego<{ id: string }>("create", { visibility, opponent: opponent || null }); setCreated(result.id); onCreated?.(result.id); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t create challenge."); } finally { setBusy(false); }
  }
  return <section className="ego-panel challenge-create"><p className="eyebrow">MISERY LOVES COMPANY</p><h2>Challenge someone worse.</h2>
    {!created ? <><label>Choose your next problem<select value={opponent} onChange={e => setOpponent(e.target.value)}><option value="">Create a shareable invitation</option>{friends.map(f => <option key={f.user_id} value={f.user_id}>{f.name}</option>)}</select></label>
      <label>Who gets to watch?<select value={visibility} onChange={e => setVisibility(e.target.value as Visibility)}><option value="public">Public — anyone can view; signed-in spectators vote</option><option value="friends">Friends only — accepted friends of either participant</option><option value="private">Challengers only — private, unranked exchange</option></select></label>
      <p className="ego-note">Both participants approve their own snapshot and this audience. Voting runs for 48 hours. Only public battles can earn ranked wins.</p><button className="ego-button" onClick={() => void create()} disabled={busy}>{busy ? "Creating…" : "Make it someone else’s problem ↗"}</button>
    </> : <><p>Your invitation is ready. It expires in seven days.</p><ShareLink path={`/challenges/${created}`} /><Link className="ego-link" href={`/challenges/${created}`}>Open your battle →</Link></>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
