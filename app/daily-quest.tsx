"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GalleryPage, GalleryPhoto } from "@/lib/gallery-types";
import { completeQuestDay, recordQuestVote } from "@/lib/checkly-quest";
import styles from "./daily-quest.module.css";

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
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ sort: "newest" });
      if (cursor.current) query.set("cursor", cursor.current);
      const response = await fetch(`/api/gallery?${query}`, { cache: "no-store", signal });
      const page: GalleryPage & { error?: string } = await response.json();
      if (!response.ok) throw new Error(page.error || "Couldn’t load memes. Please try again.");
      if (signal?.aborted) return;
      cursor.current = page.next_cursor;
      setExhausted(!page.next_cursor);
      setItems(existing => {
        const ids = new Set(existing.map(item => item.id));
        return [...existing, ...page.items.filter(item => !ids.has(item.id))];
      });
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "Couldn’t load memes. Please try again.");
    } finally { if (!signal?.aborted) setLoading(false); }
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
  const done = Math.max(0, progress.ids.length - batchStart);
  const completed = progress.ids.length >= progress.goal || (!loading && !error && exhausted && !photo && done > 0);
  useEffect(() => {
    if (ready && completed && !loading && !error) completeQuestDay(userId);
  }, [ready, completed, loading, error, userId]);

  const empty = !loading && !error && exhausted && !photo && !done;
  const total = exhausted ? Math.min(10, done + remaining.length) : 10;

  useEffect(() => {
    if (!ready || loading || error || photo || completed || exhausted) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [ready, loading, error, photo, completed, exhausted, load]);

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

  return <main id="main" data-quest-screen="voting" className={styles.quest}>
    <header className={styles.heading}><Link href="/" className={styles.back} aria-label="Back to Checkly Quest">←</Link><h1>Daily quest</h1></header>
    <p className={styles.notice} role="status" aria-live="polite">{notice}</p>
    {completed ? <section className={styles.finish} aria-labelledby="quest-complete">
      <span className={styles.badge} aria-hidden="true">✓</span>
      <h2 id="quest-complete">Quest complete</h2>
      <p>You rated {done} {done === 1 ? "meme" : "memes"}. Your votes are saved.</p>
      <button className="action-button" onClick={() => { persist({ ...progress, goal: progress.ids.length + 10 }); setExhausted(false); cursor.current = null; setNotice(""); void load(); }}>Keep on going</button>
      <Link href="/" className={styles.galleryLink}>Back to my quest dashboard ↗</Link>
    </section> : empty ? <section className={styles.finish}><h2>No more memes just yet.</h2><p>Come back for new uploads, or explore Checked Gallery.</p><button className="action-button" onClick={() => { setExhausted(false); cursor.current = null; void load(); }}>Check for new memes</button><Link href="/gallery" className={styles.galleryLink}>Checked Gallery ↗</Link></section> : <>
      <div className={styles.progress}><span>{done} / {total} rated</span><span>{busy ? "Saving…" : "Daily progress"}</span><div className={styles.progressTrack} aria-hidden="true"><span className={styles.progressFill} data-empty={done === 0} style={{ width: `${Math.min(100, done / Math.max(1, total) * 100)}%` }} /></div><progress className={styles.nativeProgress} aria-label="Daily quest progress" value={done} max={Math.max(1, total)} /></div>
      {photo && <section className={styles.deck} aria-label="Rate this meme" aria-busy={busy}>
        <button type="button" className={`${styles.voteArrow} ${styles.leftArrow}`} aria-label="Swipe left to downvote" disabled={busy || loading} onClick={() => void vote(-1)}>←</button>
        <article key={photo.id} className={`${styles.card} ${swipe === 1 ? styles.swipeRight : swipe === -1 ? styles.swipeLeft : ""}`} onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerCancel={() => { pointer.current = null; }} onPointerUp={event => {
          const start = pointer.current; pointer.current = null;
          if (!start || start.id !== event.pointerId) return;
          const dx = event.clientX - start.x; const dy = event.clientY - start.y;
          if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.3) void vote(dx > 0 ? 1 : -1);
        }}>
          <div className={styles.image}><Image key={photo.id} src={photo.photo_url} alt={photo.title || `Meme shared by ${photo.contributor_name}`} width={720} height={720} unoptimized draggable={false} /></div>
          <div className={styles.caption}><h2>{photo.title || "Fresh evidence"}</h2><p>By {photo.contributor_name}</p>{photo.description && <p>{photo.description}</p>}</div>
        </article>
        <button type="button" className={`${styles.voteArrow} ${styles.rightArrow}`} aria-label="Swipe right to upvote" disabled={busy || loading} onClick={() => void vote(1)}>→</button>
        <div className={styles.controls}><button disabled={busy || loading} onClick={() => void vote(-1)} className={styles.down}>↓ Downvote</button><button disabled={busy || loading} onClick={() => void vote(1)} className={styles.up}>↑ Upvote</button></div>
        <p className={styles.hint}>Swipe or use ← / →</p>
      </section>}
      {loading && <p role="status" className={styles.hint}>Loading fresh memes…</p>}
    </>}
    {error && <div role="alert" className={styles.error}><p>{error}</p>{!photo && <button className="secondary-button" onClick={() => void load()}>Try again</button>}</div>}
  </main>;
}
