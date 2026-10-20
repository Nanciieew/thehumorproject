"use client";

import Image from "next/image";
import { QuestBackground } from "./quest-background";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { GalleryPage, GalleryPhoto } from "@/lib/gallery-types";
import { completeQuestDay, recordQuestVote } from "@/lib/checkly-quest";
import styles from "./daily-quest.module.css";

function VoteSymbol({ up }: { up: boolean }) {
  return <svg className={styles.voteSymbol} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <g transform={up ? undefined : "translate(24 24) rotate(180)"}>
      <path d="M7 10v11H3V10h4Zm0 1 4-5V2h1a3 3 0 0 1 3 3v4h5a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7" />
    </g>
  </svg>;
}


type Progress = { ids: string[]; goal: number };
const dayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function DailyQuest({ userId }: { userId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<GalleryPhoto[]>([]);
  const [progress, setProgress] = useState<Progress>({ ids: [], goal: 10 });
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [swipe, setSwipe] = useState<1 | -1 | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [imageRatio, setImageRatio] = useState(1);
  const fetching = useRef(false);
  const completionRecorded = useRef(false);
  const cursor = useRef<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const locked = useRef(false);
  const storageKey = useRef("");
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null);

  useEffect(() => {
    storageKey.current = `checked:daily-quest:${userId}:${dayKey()}`;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey.current) ?? "null");
      if (saved && Array.isArray(saved.ids) && saved.ids.every((id: unknown) => typeof id === "string") && Number.isInteger(saved.goal) && saved.goal >= 10) {
        setProgress({ ids: [...new Set<string>(saved.ids)], goal: saved.goal });
      }
    } catch { /* Voting also works when browser storage is unavailable. */ }
    setReady(true);
  }, [userId]);

  const persist = (next: Progress) => {
    setProgress(next);
    try { localStorage.setItem(storageKey.current, JSON.stringify(next)); } catch { /* Keep progress in memory. */ }
  };

  const load = useCallback(async (signal?: AbortSignal) => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ sort: "newest" });
      if (cursor.current) query.set("cursor", cursor.current);
      const response = await fetch(`/api/gallery?${query}`, { cache: "no-store", signal });
      const page: GalleryPage & { error?: string } = await response.json();
      if (!response.ok) throw new Error(page.error || "Couldn’t load memes. Please try again.");
      if (signal?.aborted) return;
      const previousCursor = cursor.current;
      cursor.current = page.next_cursor;
      setExhausted(!page.next_cursor || page.next_cursor === previousCursor);
      setItems(existing => {
        const ids = new Set(existing.map(item => item.id));
        return [...existing, ...page.items.filter(item => { if (ids.has(item.id)) return false; ids.add(item.id); return true; })];
      });
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "Couldn’t load memes. Please try again.");
    } finally { fetching.current = false; if (!signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [ready, load]);

  const remaining = items.filter(item => !progress.ids.includes(item.id)).sort((a, b) => b.published_at.localeCompare(a.published_at) || b.id.localeCompare(a.id));
  const photo = remaining[0];
  const batchStart = progress.goal - 10;
  const done = Math.min(10, Math.max(0, progress.ids.length - batchStart));
  const hasContinued = progress.goal > 10;
  const feedEnded = ready && !loading && !error && exhausted && !photo;
  const completed = progress.ids.length >= progress.goal || (!hasContinued && done > 0 && feedEnded);
  const allChecked = feedEnded && (hasContinued || progress.ids.length === 0);
  const total = exhausted ? Math.max(1, Math.min(10, done + remaining.length)) : 10;

  useEffect(() => {
    if (ready && (completed || allChecked) && progress.ids.length > 0 && !loading && !error && !completionRecorded.current) {
      completionRecorded.current = true;
      completeQuestDay(userId);
    }
  }, [ready, completed, allChecked, progress.ids.length, loading, error, userId]);

  useEffect(() => {
    if (!ready || loading || error || remaining.length > 3 || completed || allChecked || exhausted) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [ready, loading, error, remaining.length, completed, allChecked, exhausted, load]);

  const vote = useCallback(async (value: 1 | -1) => {
    if (!photo || loading || completed || locked.current) return;
    locked.current = true; setBusy(true); setError(""); setSwipe(value);
    const animation = new Promise<void>(resolve => window.setTimeout(resolve, window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 380));
    try {
      const response = await fetch("/api/gallery/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoId: photo.id, value }) });
      const result = await response.json();
      await animation;
      if (!response.ok) throw new Error(result.error || "Your vote couldn’t be saved. Please try again.");
      const next = { ...progress, ids: [...progress.ids, photo.id] };
      setProgress(next);
      try { localStorage.setItem(storageKey.current, JSON.stringify(next)); } catch { /* Keep progress in memory. */ }
      recordQuestVote(userId, photo.id, value);
      setNotice(value === 1 ? "Upvote saved." : "Downvote saved.");
      try { sessionStorage.setItem("checked:gallery-votes-changed", "1"); } catch { /* Gallery also refreshes on focus. */ }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "Your vote couldn’t be saved. Please try again.");
    } finally { locked.current = false; setBusy(false); setSwipe(null); }
  }, [photo, loading, completed, progress, router, userId]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || target?.closest?.("input, textarea, select, [contenteditable=true], dialog")) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        void vote(event.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [vote]);

  return <main id="main" className={styles.quest} data-quest-screen="voting">
    <QuestBackground />
    <header className={styles.header}>
      <div className={styles.title}><Link href="/" aria-label="Back to Checkly Quest" className={styles.back}>←</Link><h1>Daily quest<span>.</span></h1></div>
    </header>
    {!allChecked && <section className={styles.journey} aria-label="Quest progress">
      <div className={styles.journeyHeading}><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2c1 6-5 5-4 10-2-1-3-2-3-4-4 6-2 13 6 13s10-9 5-13c1 4-1 5-2 5 2-5 0-9-2-11Z" /></svg>Your daily quest</span><strong>{done} <small>/ {total}</small></strong></div>
      <div className={styles.steps} style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }} aria-hidden="true">{Array.from({ length: total }, (_, index) => <span key={index} data-filled={index < done} data-next={index === done} />)}</div>
      <progress className="visually-hidden" aria-label="Daily quest progress" value={done} max={total} />
    </section>}
    <section className={styles.stage} aria-label="Meme voting" aria-busy={busy || loading}>
      {allChecked ? <div className={`${styles.complete} ${styles.allChecked}`}>
        <div className={styles.emptyIllustration} aria-hidden="true"><div className={styles.emptyCard}>✓</div><span>✦</span><i>✧</i><b>ALL CHECKED</b></div>
        <p>NOT A MEME LEFT UNJUDGED.</p><h2>You’re all checked.</h2><p>You’ve reached the end of the meme pile.<br />Fresh uploads will bring fresh judgments.</p>
        <div className={styles.completionActions}><Link className={styles.dashboardReturn} href="/">Back to Dashboard <span aria-hidden="true">↗</span></Link></div>
      </div> : completed ? <div className={styles.complete}>
        <div className={styles.completeMark} aria-hidden="true">✓<span>✦</span><i>✧</i></div><p>{done === 10 ? "ALL TEN. ALL YOU." : "DAILY QUEST. CHECKED."}</p><h2>Consider it checked.</h2><p>{done} {done === 1 ? "meme" : "memes"}. {done} {done === 1 ? "verdict" : "verdicts"}. Excellent judgment.</p>
        <div className={styles.completionActions}><Link href="/">Back to Dashboard</Link><button onClick={() => { persist({ ...progress, goal: progress.ids.length + 10 }); setNotice("Next round. Keep going!"); }}>Keep Going <span aria-hidden="true">→</span></button></div>
      </div> : !photo ? <div className={styles.feedState}>
        {error ? <><span aria-hidden="true">↻</span><h2>A tiny meme delay.</h2><p role="alert">{error}</p><button onClick={() => void load()}>Try again</button></> : <><span className={styles.loadingMark} aria-hidden="true">✦</span><p role="status">Finding your next meme…</p></>}
      </div> : <div className={styles.arena}>
        <button className={`${styles.reaction} ${styles.pass}`} onClick={() => void vote(-1)} disabled={busy || loading} aria-label="Meh — downvote meme"><span className={styles.reactionCircle}><VoteSymbol up={false} /></span><strong>Meh</strong><span className={styles.swipeHint} aria-hidden="true">← Swipe</span></button>
        <div className={styles.stack} style={{ "--meme-ratio": imageRatio } as CSSProperties}>
          <div className={styles.stackBack} aria-hidden="true" /><div className={styles.stackMiddle} aria-hidden="true" />
          <article key={photo.id} className={`${styles.meme} ${swipe === 1 ? styles.checking : swipe === -1 ? styles.passing : ""}`} onPointerDown={event => {
            if (!event.isPrimary || event.button !== 0 || locked.current) return;
            pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
            event.currentTarget.setPointerCapture(event.pointerId);
          }} onPointerCancel={() => { pointer.current = null; }} onPointerUp={event => {
            const start = pointer.current; pointer.current = null;
            if (!start || start.id !== event.pointerId) return;
            const dx = event.clientX - start.x; const dy = event.clientY - start.y;
            if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.3) void vote(dx > 0 ? 1 : -1);
          }}>
            <Image src={photo.photo_url} alt="Meme to rate" width={800} height={800} unoptimized draggable={false} onLoad={event => { const image = event.currentTarget; if (image.naturalHeight) setImageRatio(image.naturalWidth / image.naturalHeight); }} />
            {swipe && <span className={styles.verdict} aria-hidden="true">{swipe === 1 ? "LOL" : "MEH"}</span>}
          </article>
        </div>
        <button className={`${styles.reaction} ${styles.check}`} onClick={() => void vote(1)} disabled={busy || loading} aria-label="LOL — upvote meme"><span className={styles.reactionCircle}><VoteSymbol up /></span><strong>LOL</strong><span className={styles.swipeHint} aria-hidden="true">Swipe →</span></button>
      </div>}
      {!completed && photo && <p className={styles.gesture}>{busy ? "Saving your verdict…" : "Swipe the meme or use your arrow keys"}</p>}
    </section>
    {error && photo && <p role="alert" className={styles.voteError}>{error}</p>}
    <p className="visually-hidden" role="status" aria-live="polite">{notice}</p>
  </main>;
}
