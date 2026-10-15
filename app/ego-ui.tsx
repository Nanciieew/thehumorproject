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
      else { await navigator.clipboard.writeText(url); setMessage("Invitation copied."); }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setMessage(`Share this link: ${url}`);
    }
  }
  return <div><button className="ego-button secondary" onClick={() => void share()}>{label} ↗</button>{message && <p role="status">{message}</p>}</div>;
}

export function ChallengeCreator({ onCreated }: { onCreated?: (id: string) => void }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [opponent, setOpponent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState("");
  useEffect(() => {
    let current = true;
    void ego<Friend[]>("friends").then(r => { if (current) setFriends(r.filter(f => f.status === "accepted")); }).catch(() => {});
    return () => { current = false; };
  }, []);
  async function create() {
    setBusy(true); setError("");
    try {
      const result = await ego<{ id: string }>("create", { visibility, opponent: opponent || null });
      setCreated(result.id); onCreated?.(result.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t create challenge."); }
    finally { setBusy(false); }
  }
  return <details className="ego-panel challenge-create" open={onCreated ? true : undefined}>
    <summary>Challenge a friend <span aria-hidden="true">↗</span></summary>
    <div className="disclosure-content">
      {!created ? <>
        <label>Opponent<select value={opponent} onChange={e => setOpponent(e.target.value)}><option value="">Anyone with the invite</option>{friends.map(f => <option key={f.user_id} value={f.user_id}>{f.name}</option>)}</select></label>
        <label>Audience<select value={visibility} onChange={e => setVisibility(e.target.value as Visibility)}><option value="public">Public</option><option value="friends">Friends only</option><option value="private">Challengers only</option></select></label>
        <p className="ego-note">{visibility === "public" ? "Anyone can view. Sign in to vote." : visibility === "friends" ? "Accepted friends of either challenger can view and vote. Unranked." : "Only the two challengers. No audience voting."}</p>
        <details className="ego-details"><summary>Battle rules</summary><p className="ego-note">Each person approves their entry and audience. Voting lasts 48 hours; only public battles earn ranked wins. Invitations expire after seven days.</p></details>
        <button className="ego-button" onClick={() => void create()} disabled={busy}>{busy ? "Creating…" : "Create challenge ↗"}</button>
      </> : <>
        <p>Invite ready · expires in 7 days.</p><ShareLink path={`/challenges/${created}`} /><Link className="ego-link" href={`/challenges/${created}`}>Open battle →</Link>
      </>}
      {error && <p role="alert">{error}</p>}
    </div>
  </details>;
}
