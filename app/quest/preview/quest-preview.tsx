"use client";

import Image from "next/image";
import { QuestBackground } from "../../quest-background";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { GalleryPage, GalleryPhoto } from "@/lib/gallery-types";
import styles from "./quest-preview.module.css";

const sample = "/quest-preview/sample-meme.svg";
const goal = 10;

function VoteSymbol({ up }: { up: boolean }) {
  return <svg className={styles.voteSymbol} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <g transform={up ? undefined : "translate(24 24) rotate(180)"}>
      <path d="M7 10v11H3V10h4Zm0 1 4-5V2h1a3 3 0 0 1 3 3v4h5a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7" />
    </g>
  </svg>;
}

export function QuestPreview() {
  const [memes, setMemes] = useState<GalleryPhoto[]>([]);
  const [rated, setRated] = useState(0);
  const [batchOffset, setBatchOffset] = useState(0);
  const [hasContinued, setHasContinued] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState("");
  const cursor = useRef<string | null>(null);
  const fetching = useRef(false);
  const [direction, setDirection] = useState<1 | -1 | null>(null);
  const [notice, setNotice] = useState("");
  const [imageRatio, setImageRatio] = useState(1);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null);
  const currentMeme = memes[batchOffset + rated];
  const feedEnded = !currentMeme && exhausted && !loading && !error;
  const complete = rated >= goal || (!hasContinued && rated > 0 && feedEnded);
  const allChecked = feedEnded && (hasContinued || rated === 0);
  const roundGoal = exhausted ? Math.max(1, Math.min(goal, memes.length - batchOffset)) : goal;

  const load = useCallback(async (signal?: AbortSignal) => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ sort: "newest" });
      if (cursor.current) query.set("cursor", cursor.current);
      const response = await fetch(`/api/gallery?${query}`, { signal, cache: "no-store" });
      const page: GalleryPage & { error?: string } = await response.json();
      if (!response.ok) throw new Error(page.error || "The memes are taking a moment. Try again?");
      if (signal?.aborted) return;
      const previousCursor = cursor.current;
      cursor.current = page.next_cursor;
      setExhausted(!page.next_cursor || page.next_cursor === previousCursor);
      setMemes(existing => {
        const seen = new Set(existing.map(item => item.id));
        const incoming = [...page.items].sort((a, b) => b.published_at.localeCompare(a.published_at) || b.id.localeCompare(a.id));
        return [...existing, ...incoming.filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true; })];
      });
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "The memes are taking a moment. Try again?");
    } finally { fetching.current = false; if (!signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const start = setTimeout(() => void load(controller.signal), 0);
    return () => { clearTimeout(start); controller.abort(); if (timer.current) clearTimeout(timer.current); };
  }, [load]);

  useEffect(() => {
    if (!complete && !loading && !exhausted && !error && memes.length - batchOffset - rated <= 3) void load();
  }, [complete, loading, exhausted, error, memes.length, batchOffset, rated, load]);

  const vote = useCallback((value: 1 | -1) => {
    if (locked.current || complete || !currentMeme) return;
    locked.current = true;
    setDirection(value);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(() => {
      setRated(current => Math.min(goal, current + 1));
      setNotice(value === 1 ? "LOL. Upvote previewed." : "Meh. Downvote previewed.");
      setDirection(null);
      locked.current = false;
    }, reduced ? 0 : 380);
  }, [complete, currentMeme]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || (event.target as HTMLElement)?.closest("input, textarea, select, [contenteditable=true], dialog")) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault(); vote(event.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vote]);

  return <main id="main" className={styles.preview} data-quest-screen="voting">
    <QuestBackground />
    <header className={styles.header}>
      <div className={styles.title}><Link href="/my-works" aria-label="Back to My Checkboard" className={styles.back}>←</Link><h1>Daily quest<span>.</span></h1></div>
      <span className={styles.previewBadge}><i /> Design preview</span>
    </header>
    {!allChecked && <section className={styles.journey} aria-label="Quest progress">
      <div className={styles.journeyHeading}><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2c1 6-5 5-4 10-2-1-3-2-3-4-4 6-2 13 6 13s10-9 5-13c1 4-1 5-2 5 2-5 0-9-2-11Z" /></svg>Your daily ten</span><strong>{rated} <small>/ {roundGoal}</small></strong></div>
      <div className={styles.steps} style={{ gridTemplateColumns: `repeat(${roundGoal}, 1fr)` }} aria-hidden="true">{Array.from({ length: roundGoal }, (_, index) => <span key={index} data-filled={index < rated} data-next={index === rated} />)}</div>
      <progress className="visually-hidden" aria-label="Daily quest progress" value={rated} max={roundGoal} />
    </section>}
    <section className={styles.stage} aria-label="Meme voting preview">
      {allChecked ? <div className={`${styles.complete} ${styles.allChecked}`}>
        <div className={styles.emptyIllustration} aria-hidden="true"><div className={styles.emptyCard}>✓</div><span>✦</span><i>✧</i><b>ALL CHECKED</b></div>
        <p>NOT A MEME LEFT UNJUDGED.</p><h2>You’re all checked.</h2><p>You’ve reached the end of the meme pile.<br />Fresh uploads will bring fresh judgments.</p>
        <div className={styles.completionActions}><Link className={styles.dashboardReturn} href="/gallery">Back to Gallery <span aria-hidden="true">↗</span></Link></div>
      </div> : complete ? <div className={styles.complete}>
        <div className={styles.completeMark} aria-hidden="true">✓<span>✦</span><i>✧</i></div><p>{rated === goal ? "ALL TEN. ALL YOU." : "DAILY QUEST. CHECKED."}</p><h2>Consider it checked.</h2><p>{rated} {rated === 1 ? "meme" : "memes"}. {rated} {rated === 1 ? "verdict" : "verdicts"}. Excellent judgment.</p><div className={styles.completionActions}><Link href="/gallery">Back to Gallery</Link><button onClick={() => { setHasContinued(true); setBatchOffset(current => current + rated); setRated(0); setNotice("Next round. Keep going!"); }}>Keep Going <span aria-hidden="true">→</span></button></div>
      </div> : !currentMeme ? <div className={styles.feedState}>
        {error ? <><span aria-hidden="true">↻</span><h2>A tiny meme delay.</h2><p role="alert">{error}</p><button onClick={() => void load()}>Try again</button></> : <><span className={styles.loadingMark} aria-hidden="true">✦</span><p role="status">Finding your next meme…</p></>}
      </div> : <div className={styles.arena}>
        <button className={`${styles.reaction} ${styles.pass}`} onClick={() => vote(-1)} disabled={direction !== null} aria-label="Meh — downvote meme"><span className={styles.reactionCircle}><VoteSymbol up={false} /></span><strong>Meh</strong><span className={styles.swipeHint} aria-hidden="true">← Swipe</span></button>
        <div className={styles.stack} style={{ "--meme-ratio": imageRatio } as CSSProperties}>
          <div className={styles.stackBack} aria-hidden="true" /><div className={styles.stackMiddle} aria-hidden="true" />
          <article key={currentMeme.id} className={`${styles.meme} ${direction === 1 ? styles.checking : direction === -1 ? styles.passing : ""}`} onPointerDown={event => {
            if (!event.isPrimary || event.button !== 0 || locked.current) return;
            pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
            event.currentTarget.setPointerCapture(event.pointerId);
          }} onPointerCancel={() => { pointer.current = null; }} onPointerUp={event => {
            const start = pointer.current; pointer.current = null;
            if (!start || start.id !== event.pointerId) return;
            const dx = event.clientX - start.x; const dy = event.clientY - start.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) vote(dx > 0 ? 1 : -1);
          }}>
            <Image src={currentMeme.photo_url} alt="Meme to rate" width={800} height={800} unoptimized draggable={false} onLoad={event => { const image = event.currentTarget; if (image.naturalHeight) setImageRatio(image.naturalWidth / image.naturalHeight); }} onError={event => { event.currentTarget.src = sample; }} />
            {direction && <span className={styles.verdict} aria-hidden="true">{direction === 1 ? "LOL" : "MEH"}</span>}
          </article>
        </div>
        <button className={`${styles.reaction} ${styles.check}`} onClick={() => vote(1)} disabled={direction !== null} aria-label="LOL — upvote meme"><span className={styles.reactionCircle}><VoteSymbol up /></span><strong>LOL</strong><span className={styles.swipeHint} aria-hidden="true">Swipe →</span></button>
      </div>}
      {!complete && currentMeme && <p className={styles.gesture}>Swipe the meme or use your arrow keys</p>}
    </section>
    <footer className={styles.footer}><span>Preview only · votes and streaks stay unchanged</span><Link href="/quest">Current design <span aria-hidden="true">↗</span></Link></footer>
    <p className="visually-hidden" role="status" aria-live="polite">{notice}</p>
  </main>;
}
