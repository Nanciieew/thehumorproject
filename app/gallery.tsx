"use client";

import { announceVoteChange, VOTES_CHANGED_EVENT } from "@/lib/vote-updates";
import Image from "next/image";
import Link from "next/link";
import { Suspense, use, useCallback, useEffect, useRef, useState } from "react";
import { MemeImage } from "./meme-image";
import { FeedSkeleton } from "./page-skeleton";
import styles from "./gallery-play.module.css";
import { PhotoInput } from "./photo-input";
import { Icon } from "./ui";
import { GALLERY_MIME_TYPES, MAX_GALLERY_BYTES, type GalleryPage, type GalleryPhoto, type GallerySort, type Vote } from "@/lib/gallery-types";
type InitialGallery = GalleryPage | Promise<GalleryPage | undefined>;

function Thumb({ down = false }: { down?: boolean }) {
  return <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill={down ? "none" : "currentColor"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={down ? { transform: "rotate(180deg)" } : undefined}><path d="M7 11 11 2a3 3 0 0 1 3 3v4h5.66a2 2 0 0 1 1.98 2.28l-1.38 9A2 2 0 0 1 18.28 22H7Z" /><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></svg>;
}

function LoginPrompt({ close }: { close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onCancel={close} aria-labelledby="vote-login-title" className="design-dialog login-dialog">
    <h2 id="vote-login-title" className="text-2xl font-bold">Make your vote count.</h2>
    <p className="mt-3 text-sm leading-relaxed opacity-70">Log in and finish setting up your account to vote or share a photo.</p>
    <Link href="/login" className="action-button wide center-button">Log in</Link>
    <button onClick={close} className="dialog-cancel">Keep browsing</button>
  </dialog>;
}

type VoteUpdate = (id: string, vote: Vote, count: number, pending: boolean, clicked?: 1 | -1) => void;
function orderPhotos(items: GalleryPhoto[], sort: GallerySort) {
  return [...items].sort((a, b) => (sort === "newest" ? 0 : b.upvotes - a.upvotes) || b.published_at.localeCompare(a.published_at) || b.id.localeCompare(a.id));
}

function GalleryCard({ photo, rank, leading, feedback, signedIn, requestLogin, updateVote }: { rank?: number; leading: boolean; feedback?: 1 | -1; photo: GalleryPhoto; signedIn: boolean; requestLogin: () => void; updateVote: VoteUpdate }) {
  const vote = photo.vote;
  const count = photo.upvotes;
  const downloadName = `checked-meme-${photo.id}.webp`;
  const downloadUrl = new URL(photo.photo_url);
  downloadUrl.searchParams.set("download", downloadName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function choose(choice: 1 | -1) {
    if (!signedIn) { requestLogin(); return; }
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    const previous = { vote, count };
    const next = vote === choice ? null : choice;
    updateVote(photo.id, next, Math.max(0, count + Number(next === 1) - Number(vote === 1)), true, choice);
    try {
      const response = await fetch("/api/gallery/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoId: photo.id, value: next }) });
      const result = await response.json();
      if (!response.ok) { if (response.status === 401) requestLogin(); throw new Error(result.error); }
      updateVote(photo.id, result.vote, result.upvotes, false);
      announceVoteChange();
    } catch (error) {
      updateVote(photo.id, previous.vote, previous.count, false);
      setError(error instanceof Error && !(error instanceof TypeError) ? error.message : "Your vote couldn’t be saved. Please try again.");
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <article id={`photo-${photo.id}`} className={`gallery-card ${styles.card}`} data-leading={leading} data-kind={photo.kind === "ego" || photo.result ? "ego" : "memes"}>
    <div className="card-image"><MemeImage src={photo.photo_url} alt={photo.title || `Meme shared by ${photo.contributor_name}`} width={400} height={400} sizes="(max-width: 650px) 100vw, (max-width: 1150px) 50vw, 25vw" loading={rank === 1 ? "eager" : "lazy"} />{rank && <span className={styles.rank} aria-label={`Rank ${rank}`}>#{rank}{leading && <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="m2 6 5 4 5-7 5 7 5-4-3 14H5Z"/></svg>}</span>}<a className={styles.download} href={downloadUrl.href} download={downloadName} aria-label="Download meme" title="Download meme"><Icon name="download" /></a></div>
    <div className="card-info">
      <h3 title={photo.title || photo.contributor_name}><span className={styles.creator}><span className={styles.avatar} aria-hidden="true">{photo.contributor_photo_url ? <Image src={photo.contributor_photo_url} alt="" width={38} height={38} unoptimized /> : <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M3 23v-3a9 9 0 0 1 18 0v3Z"/></svg>}</span><span className={styles.creatorName}>{photo.contributor_name}</span></span></h3>
      {photo.result && <p className="battle-tally">{photo.result.outcome} · Battle votes: {photo.result.battle_votes} · Gallery upvotes: {count}</p>}
      {photo.result && <blockquote className="work-card-description">{photo.result.roast}</blockquote>}
      {photo.description && (!photo.result || photo.description !== photo.result.roast) && <p className="work-card-description">{photo.description}</p>}
      <div className="card-votes" aria-label="Photo voting" aria-busy={busy}>
        <button type="button" aria-label={`Upvote: ${count} ${count === 1 ? "upvote" : "upvotes"}`} aria-pressed={vote === 1} data-feedback={feedback === 1 || undefined} disabled={busy} onClick={() => void choose(1)} className={`vote-button ${vote === 1 ? "text-blue-600" : vote === -1 ? "text-gray-400" : ""}`}><Thumb /><span>{new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(count)}</span></button>
        <button type="button" aria-label="Downvote" aria-pressed={vote === -1} data-feedback={feedback === -1 || undefined} disabled={busy} onClick={() => void choose(-1)} className={`vote-button down ${vote === -1 ? "text-red-600" : vote === 1 ? "text-gray-400" : ""}`}><Thumb down /></button>
      </div>
      {error && <p role="alert" className="form-error">{error}</p>}
    </div>
  </article>;
}

function GalleryFeed({ sort, search, kind, initial, signedIn, requestLogin }: { sort: GallerySort; search: string; kind: string; initial?: InitialGallery; signedIn: boolean; requestLogin: () => void }) {
  const page = initial && "then" in initial ? use(initial) : initial;
  const [items, setItems] = useState(page?.items ?? []);
  const [cursor, setCursor] = useState(page?.next_cursor ?? null);
  const [started, setStarted] = useState(Boolean(page));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const revision = useRef(0);
  const pendingVotes = useRef(new Set<string>());
  const [refreshing, setRefreshing] = useState(false);
  const feedbackTimers = useRef(new Map<string, number>());
  const [voteFeedback, setVoteFeedback] = useState<{ order: string[]; clicks: Record<string, 1 | -1> } | null>(null);
  useEffect(() => {
    const timers = feedbackTimers.current;
    return () => { for (const timer of timers.values()) window.clearTimeout(timer); timers.clear(); };
  }, []);
  const updateVote = useCallback<VoteUpdate>((id, vote, count, pending, clicked) => {
    revision.current++;
    if (pending) pendingVotes.current.add(id); else pendingVotes.current.delete(id);
    if (clicked) {
      // Keep the visible order while the clicked thumb acknowledges the vote.
      const order = orderPhotos(itemsRef.current, sort).map(photo => photo.id);
      setVoteFeedback(current => ({ order: current?.order ?? order, clicks: { ...current?.clicks, [id]: clicked } }));
      window.clearTimeout(feedbackTimers.current.get(id));
      feedbackTimers.current.set(id, window.setTimeout(() => {
        feedbackTimers.current.delete(id);
        setVoteFeedback(current => {
          if (!current) return null;
          const clicks = { ...current.clicks }; delete clicks[id];
          return Object.keys(clicks).length ? { ...current, clicks } : null;
        });
      }, 500));
    }
    setItems(existing => existing.map(photo => photo.id === id ? { ...photo, vote, upvotes: count } : photo));
  }, [sort]);
  const ordered = orderPhotos(items, sort);
  const leaderId = sort === "newest" ? undefined : ordered[0]?.id;
  // Every meme has a unique position; newer publications win equal scores.
  const ranks = new Map(ordered.map((photo, index) => [photo.id, index + 1]));
  if (voteFeedback) {
    const positions = new Map(voteFeedback.order.map((id, index) => [id, index]));
    ordered.sort((a, b) => (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity));
  }
  const sentinel = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; setLoading(true); setError("");
    const abort = new AbortController(); controller.current = abort;
    try {
      const query = new URLSearchParams({ sort, search, ...(kind !== "all" ? { kind } : {}) }); if (cursor) query.set("cursor", cursor);
      let response = await fetch(`/api/gallery?${query}`, { signal: abort.signal });
      let page = await response.json();
      const reset = response.status === 409 && page.code === "GALLERY_CURSOR_EXPIRED";
      if (reset) {
        response = await fetch(`/api/gallery?${new URLSearchParams({ sort, search, ...(kind !== "all" ? { kind } : {}) })}`, { signal: abort.signal });
        page = await response.json();
      }
      if (!response.ok) throw new Error(page.error);
      if (abort.signal.aborted) return;
      setItems((existing) => { if (reset) return page.items; const ids = new Set(existing.map((item) => item.id)); return [...existing, ...page.items.filter((item: GalleryPhoto) => !ids.has(item.id))]; });
      setCursor(page.next_cursor); setStarted(true);
    } catch (error) {
      if (!abort.signal.aborted) setError(error instanceof Error && !(error instanceof TypeError) ? error.message : "Couldn’t load more photos. Please try again.");
    } finally { if (controller.current === abort) { inFlight.current = false; if (!abort.signal.aborted) setLoading(false); } }
  }, [sort, search, kind, cursor]);
  useEffect(() => () => { controller.current?.abort(); inFlight.current = false; }, []);
  useEffect(() => {
    // Re-read the entire visible prefix so photos rising from later pages can enter it.
    let stopped = false;
    const refresh = async () => {
      if (document.visibilityState === "hidden" || inFlight.current || pendingVotes.current.size || feedbackTimers.current.size) return;
      inFlight.current = true;
      setRefreshing(true);
      const version = revision.current;
      const abort = new AbortController(); controller.current = abort;
      try {
        const pages = Math.max(1, Math.ceil(itemsRef.current.length / 30));
        let next: string | null = null;
        const refreshed = new Map<string, GalleryPhoto>();
        for (let index = 0; index < pages; index++) {
          const query = new URLSearchParams({ sort, search, ...(kind !== "all" ? { kind } : {}) });
          if (next) query.set("cursor", next);
          const response = await fetch(`/api/gallery?${query}`, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)]), cache: "no-store" });
          const page: GalleryPage = await response.json();
          if (!response.ok) throw new Error("Gallery refresh failed");
          for (const photo of page.items) refreshed.set(photo.id, photo);
          next = page.next_cursor;
          if (!next) break;
        }
        if (!stopped && !abort.signal.aborted && version === revision.current) {
          setItems([...refreshed.values()]); setCursor(next); setStarted(true);
        }
      } catch { /* Keep the visible gallery and retry on the next refresh. */ }
      finally {
        if (controller.current === abort) inFlight.current = false;
        if (!stopped) setRefreshing(false);
      }
    };
    try { if (sessionStorage.getItem("checked:gallery-votes-changed")) void refresh(); } catch { /* Focus refresh remains available. */ }
    const timer = window.setInterval(() => void refresh(), 15_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener(VOTES_CHANGED_EVENT, onFocus);
    window.addEventListener("storage", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { stopped = true; window.clearInterval(timer); window.removeEventListener("focus", onFocus); window.removeEventListener(VOTES_CHANGED_EVENT, onFocus); window.removeEventListener("storage", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [sort, search, kind]);
  useEffect(() => {
    if ((started && !cursor) || loading || refreshing || error || !sentinel.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void load(); }, { rootMargin: "600px" });
    observer.observe(sentinel.current); return () => observer.disconnect();
  }, [started, cursor, loading, refreshing, error, load]);
  return <>
    <ul aria-label="Avatar gallery" className={styles.grid}>
      {ordered.map(photo => <li key={photo.id}><GalleryCard feedback={voteFeedback?.clicks[photo.id]} rank={sort === "newest" ? undefined : ranks.get(photo.id)} leading={photo.id === leaderId} photo={photo} signedIn={signedIn} requestLogin={requestLogin} updateVote={updateVote} /></li>)}
    </ul>
    {started && !items.length && !cursor && !loading && !error && <div className="gallery-empty">
      <p className="text-xl font-semibold">{search ? "No matches yet." : "Nothing here yet."}</p>
      <p className="mt-3 text-sm opacity-65">{search ? "Try another search or filter." : "Create a meme and start the votes."}</p>
    </div>}
    <div ref={sentinel} className="gallery-status">
      {loading && <p role="status">Loading gallery…</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={() => void load()} className="secondary-button">Try again</button></div>}
      {started && items.length > 0 && !cursor && !loading && !error && <p>You’re all caught up.</p>}
    </div>
  </>;
}

export function UploadPhoto({ close, published }: { close: () => void; published: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const uploaded = useRef<string | null>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function publish() {
    if (!file || inFlight.current) return;
    if (!GALLERY_MIME_TYPES.includes(file.type) || !file.size || file.size > MAX_GALLERY_BYTES) { setError("Choose a JPG, PNG, or WebP photo up to 10 MB."); return; }
    inFlight.current = true; setError("");
    try {
      if (!uploaded.current) {
        setStatus("Preparing upload…");
        const ticketResponse = await fetch("/api/gallery/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ size: file.size, type: file.type }) });
        const ticket = await ticketResponse.json(); if (!ticketResponse.ok) throw new Error(ticket.error);
        setStatus("Uploading photo…");
        const body = new FormData(); body.append("cacheControl", "600"); body.append("", file);
        const response = await fetch(ticket.signedUrl, { method: "PUT", body });
        if (!response.ok) throw new Error("The upload didn’t finish. Check your connection and try again.");
        uploaded.current = ticket.uploadId;
      }
      setStatus("Checking and publishing…");
      const response = await fetch("/api/gallery/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId: uploaded.current, source: "upload" }) });
      const result = await response.json();
      if (!response.ok) { uploaded.current = null; throw new Error(result.error); }
      published();
    } catch (error) { setError(error instanceof Error && !(error instanceof TypeError) ? error.message : "Couldn’t publish your photo. Please try again."); }
    finally { inFlight.current = false; setStatus(""); }
  }
  return <dialog ref={dialog} onCancel={(event) => { if (inFlight.current) event.preventDefault(); else close(); }} aria-labelledby="upload-title" className="design-dialog upload-dialog">
    <p className="eyebrow">MAKE A LITTLE ENTRANCE</p><h2 id="upload-title">HELLO, NEW FACE.</h2>
    <p className="mt-3 text-sm leading-relaxed opacity-70">Your photo and full name will appear publicly in the gallery.</p>
    <PhotoInput fileName={fileName} onSelect={setFileName} onFile={(value) => { setFile(value); uploaded.current = null; setError(""); }} disabled={Boolean(status)} label="Choose gallery photo" describedBy="gallery-photo-help" />
    <p id="gallery-photo-help" className="mt-3 text-xs opacity-65">JPG, PNG, or WebP · Up to 10 MB and 24 megapixels · No animations</p>
    {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
    {status && <p role="status" className="mt-4 text-sm">{status}</p>}
    <button onClick={() => void publish()} disabled={!file || Boolean(status)} className="action-button wide center-button">Publish photo</button>
    <button onClick={close} disabled={Boolean(status)} className="dialog-cancel">Cancel</button>
  </dialog>;
}

export function Gallery({ initial, userId, initialSort = "top" }: { initial?: InitialGallery; userId: string | null; initialSort?: GallerySort }) {
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState<GallerySort>(initialSort);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const [revision, setRevision] = useState(0);
  const [login, setLogin] = useState(false);
  const [message, setMessage] = useState("");
  const requestLogin = useCallback(() => setLogin(true), []);
  return <main id="main" data-gallery-screen className={styles.page}>
    <div className={styles.decorations} aria-hidden="true" />
    <header className={styles.hero}>
      <h1 id="gallery-title" className={styles.title} aria-label="Checked Gallery">Checked Gallery<span>.</span></h1>
      <div className={styles.headerActions}>
        <label className={styles.search}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg><input type="search" aria-label="Search gallery" placeholder="Search memes, creators, tags..." value={searchInput} onChange={event => setSearchInput(event.target.value)} /></label>
        <Link href="/disguise" className={styles.create}><Icon name="create" />Create meme</Link>
      </div>
    </header>
    <section className={styles.collection} aria-labelledby="gallery-title">
      <div className={styles.toolbar}>
        <div className={styles.filterGroup} role="group" aria-label="Content type"><span>Show</span>{[["all", "All"], ["memes", "Memes"], ["ego", "Checked Ego"]].map(([value, label]) => <button key={value} aria-pressed={kind === value} onClick={() => { if (kind !== value) { setKind(value); setRevision(v => v + 1); } }}>{label}</button>)}</div>
        <div className={styles.filterGroup} role="group" aria-label="Sort gallery"><span>Sort</span>{([["top", "Most upvotes"], ["newest", "Newest first"]] as const).map(([value, label]) => <button key={value} aria-pressed={sort === value} onClick={() => { if (sort !== value) { setSort(value); setRevision(v => v + 1); setMessage(""); } }}>{label}</button>)}</div>
      </div>
      {message && <p role="status" className="gallery-message">{message}</p>}
      <Suspense fallback={<FeedSkeleton />}>
        <GalleryFeed kind={kind} key={`${sort}:${userId}:${revision}:${search}`} sort={sort} search={search} initial={!search && sort === initialSort && revision === 0 ? initial : undefined} signedIn={Boolean(userId)} requestLogin={requestLogin} />
      </Suspense>
    </section>

    {login && <LoginPrompt close={() => setLogin(false)} />}
  </main>;
}
