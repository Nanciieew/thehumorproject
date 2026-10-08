"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./gallery-play.module.css";
import { PhotoInput } from "./photo-input";
import { Icon } from "./ui";
import { GALLERY_MIME_TYPES, MAX_GALLERY_BYTES, type GalleryPage, type GalleryPhoto, type GallerySort, type Vote } from "@/lib/gallery-types";

function Thumb({ down = false }: { down?: boolean }) {
  return <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={down ? "rotate-180" : ""}>
    <path d="M7 10v11H3V10h4Zm0 0 5-7c1-1 3 0 3 2l-1 5h5a2 2 0 0 1 2 2l-2 7a3 3 0 0 1-3 2H7" />
  </svg>;
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

function GalleryCard({ photo, signedIn, requestLogin, updateVote }: { photo: GalleryPhoto; signedIn: boolean; requestLogin: () => void; updateVote: (id: string, vote: Vote, count: number, pending: boolean) => void }) {
  const vote = photo.vote;
  const count = photo.upvotes;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function choose(choice: 1 | -1) {
    if (!signedIn) { requestLogin(); return; }
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    const previous = { vote, count };
    const next = vote === choice ? null : choice;
    updateVote(photo.id, next, Math.max(0, count + Number(next === 1) - Number(vote === 1)), true);
    try {
      const response = await fetch("/api/gallery/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoId: photo.id, value: next }) });
      const result = await response.json();
      if (!response.ok) { if (response.status === 401) requestLogin(); throw new Error(result.error); }
      updateVote(photo.id, result.vote, result.upvotes, false);
    } catch (error) {
      updateVote(photo.id, previous.vote, previous.count, false);
      setError(error instanceof Error && !(error instanceof TypeError) ? error.message : "Your vote couldn’t be saved. Please try again.");
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <article id={`photo-${photo.id}`} className={`gallery-card ${styles.card}`}>
    <div className="card-image"><Image src={photo.photo_url} alt={`Avatar shared by ${photo.contributor_name}`} width={400} height={400} unoptimized /><span className="image-tag">{photo.source === "generated" ? "FROM THE STUDIO" : "JUST BE YOU"}</span></div>
    <div className="card-info">
      <h3 title={photo.title || photo.contributor_name}><Link className={styles.cardLink} href={`/avatars/${photo.id}`}>{photo.title || photo.contributor_name}</Link></h3><p>{photo.title ? `By ${photo.contributor_name}` : photo.source === "generated" ? "Made in Image Studio" : "Shared with the community"}</p>
      {photo.description && <p className="work-card-description">{photo.description}</p>}
      <div className="card-votes" aria-label="Photo voting" aria-busy={busy}>
        <button type="button" aria-label={`Upvote: ${count} ${count === 1 ? "upvote" : "upvotes"}`} aria-pressed={vote === 1} disabled={busy} onClick={() => void choose(1)} className={`vote-button ${vote === 1 ? "text-blue-600" : vote === -1 ? "text-gray-400" : ""}`}><Thumb /><span>{count}</span></button>
        <button type="button" aria-label="Downvote" aria-pressed={vote === -1} disabled={busy} onClick={() => void choose(-1)} className={`vote-button down ${vote === -1 ? "text-red-600" : vote === 1 ? "text-gray-400" : ""}`}><Thumb down /></button>
      </div>
      {error && <p role="alert" className="form-error">{error}</p>}
    </div>
  </article>;
}

function GalleryFeed({ sort, search, initial, signedIn, requestLogin }: { sort: GallerySort; search: string; initial?: GalleryPage; signedIn: boolean; requestLogin: () => void }) {
  const [items, setItems] = useState(initial?.items ?? []);
  const [cursor, setCursor] = useState(initial?.next_cursor ?? null);
  const [started, setStarted] = useState(Boolean(initial));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const revision = useRef(0);
  const pendingVotes = useRef(new Set<string>());
  const [refreshing, setRefreshing] = useState(false);
  const updateVote = useCallback((id: string, vote: Vote, count: number, pending: boolean) => {
    revision.current++;
    if (pending) pendingVotes.current.add(id); else pendingVotes.current.delete(id);
    setItems((existing) => existing.map((photo) => photo.id === id ? { ...photo, vote, upvotes: count } : photo));
  }, []);
  const ordered = [...items].sort((a, b) => ((sort === "newest" || sort === "month") ? 0 : b.upvotes - a.upvotes) || b.published_at.localeCompare(a.published_at) || b.id.localeCompare(a.id));
  const sentinel = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; setLoading(true); setError("");
    const abort = new AbortController(); controller.current = abort;
    try {
      const query = new URLSearchParams({ sort, search }); if (cursor) query.set("cursor", cursor);
      let response = await fetch(`/api/gallery?${query}`, { signal: abort.signal });
      let page = await response.json();
      const reset = response.status === 409 && page.code === "GALLERY_CURSOR_EXPIRED";
      if (reset) {
        response = await fetch(`/api/gallery?${new URLSearchParams({ sort, search })}`, { signal: abort.signal });
        page = await response.json();
      }
      if (!response.ok) throw new Error(page.error);
      if (abort.signal.aborted) return;
      setItems((existing) => { if (reset) return page.items; const ids = new Set(existing.map((item) => item.id)); return [...existing, ...page.items.filter((item: GalleryPhoto) => !ids.has(item.id))]; });
      setCursor(page.next_cursor); setStarted(true);
    } catch (error) {
      if (!abort.signal.aborted) setError(error instanceof Error && !(error instanceof TypeError) ? error.message : "Couldn’t load more photos. Please try again.");
    } finally { if (controller.current === abort) { inFlight.current = false; if (!abort.signal.aborted) setLoading(false); } }
  }, [sort, search, cursor]);
  useEffect(() => () => { controller.current?.abort(); inFlight.current = false; }, []);
  useEffect(() => {
    // Re-read the entire visible prefix so photos rising from later pages can enter it.
    let stopped = false;
    const refresh = async () => {
      if (document.visibilityState === "hidden" || inFlight.current || pendingVotes.current.size) return;
      inFlight.current = true;
      setRefreshing(true);
      const version = revision.current;
      const abort = new AbortController(); controller.current = abort;
      try {
        const pages = Math.max(1, Math.ceil(itemsRef.current.length / 30));
        let next: string | null = null;
        const refreshed = new Map<string, GalleryPhoto>();
        for (let index = 0; index < pages; index++) {
          const query = new URLSearchParams({ sort, search });
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
    const timer = window.setInterval(() => void refresh(), 15_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { stopped = true; window.clearInterval(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [sort, search]);
  useEffect(() => {
    if ((started && !cursor) || loading || refreshing || error || !sentinel.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void load(); }, { rootMargin: "600px" });
    observer.observe(sentinel.current); return () => observer.disconnect();
  }, [started, cursor, loading, refreshing, error, load]);
  return <>
    <ul aria-label="Avatar gallery" className="gallery-grid">
      {ordered.map((photo) => <li key={photo.id}><GalleryCard photo={photo} signedIn={signedIn} requestLogin={requestLogin} updateVote={updateVote} /></li>)}
    </ul>
    {started && !items.length && !cursor && !loading && !error && <div className="gallery-empty">
      <p className="text-xl font-semibold">{search ? "No avatars found." : sort === "month" ? "No new avatars this month yet." : "Be the first face in the gallery."}</p>
      <p className="mt-3 text-sm opacity-65">{search ? "Try another avatar name or clear your search." : "Share an avatar you love and let the votes begin."}</p>
    </div>}
    <div ref={sentinel} className="gallery-status">
      {loading && <p role="status">Loading avatars…</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={() => void load()} className="secondary-button">Try again</button></div>}
      {started && items.length > 0 && !cursor && !loading && !error && <p>You’re all caught up.</p>}
    </div>
  </>;
}

function UploadPhoto({ close, published }: { close: () => void; published: () => void }) {
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

export function Gallery({ initial, userId }: { initial?: GalleryPage; userId: string | null }) {
  const [sort, setSort] = useState<GallerySort>("top");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const [revision, setRevision] = useState(0);
  const [login, setLogin] = useState(false);
  const [upload, setUpload] = useState(false);
  const [message, setMessage] = useState("");
  const requestLogin = useCallback(() => setLogin(true), []);
  return <main id="main">
    <header className={styles.hero}>
      <h1 id="gallery-title" className={styles.title} aria-label="Avatar Gallery">{["AVATAR", "GALLERY"].map(word => <span className={styles.word} key={word} aria-hidden="true">{Array.from(word).map((letter, index) => <span className={styles.letter} key={index}>{letter}</span>)}</span>)}</h1>
      <div className="hero-actions"><button aria-label="Upload photo" onClick={() => userId ? setUpload(true) : requestLogin()} className="action-button">Share your photo <span><Icon name="upload" /></span></button>{userId ? <Link href="/image-studio" className="text-button">Make something new <span aria-hidden="true">↗</span></Link> : <button onClick={requestLogin} className="text-button">Make something new <span aria-hidden="true">↗</span></button>}</div>
    </header>

    <section className="gallery-section" aria-labelledby="gallery-title">
      <div className={styles.searchRow}><label className="gallery-search"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg><input type="search" aria-label="Search by avatar name" placeholder="Search by avatar name" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label></div>
      <div className={styles.filterbar}><div aria-label="Sort gallery" className={styles.filters}>{([["top", "Most votes overall", "Most votes overall"], ["month", "New this month", "New this month"], ["newest", "Newest first", "Newest first"]] as const).map(([value, label, accessibleLabel]) => <button key={value} aria-label={accessibleLabel} aria-pressed={sort === value} onClick={() => { if (sort !== value) { setSort(value); setRevision((value) => value + 1); setMessage(""); } }}><span aria-hidden="true">{value === "top" ? "★" : value === "month" ? "✿" : "✦"}</span>{label}</button>)}</div></div>
      {message && <p role="status" className="gallery-message">{message}</p>}
      <GalleryFeed key={`${sort}:${userId}:${revision}:${search}`} sort={sort} search={search} initial={!search && sort === "top" && revision === 0 ? initial : undefined} signedIn={Boolean(userId)} requestLogin={requestLogin} />
    </section>

    {login && <LoginPrompt close={() => setLogin(false)} />}
    {upload && <UploadPhoto close={() => setUpload(false)} published={() => { setUpload(false); setSort("newest"); setRevision((value) => value + 1); setMessage("Your avatar is live. Welcome to the gallery!"); }} />}
  </main>;
}
