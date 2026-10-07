"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PhotoInput } from "./photo-input";
import { Icon, Smile } from "./ui";
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

function GalleryCard({ photo, signedIn, requestLogin }: { photo: GalleryPhoto; signedIn: boolean; requestLogin: () => void }) {
  const [vote, setVote] = useState<Vote>(photo.vote);
  const [count, setCount] = useState(photo.upvotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function choose(choice: 1 | -1) {
    if (!signedIn) { requestLogin(); return; }
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    const previous = { vote, count };
    const next = vote === choice ? null : choice;
    setVote(next); setCount(Math.max(0, count + Number(next === 1) - Number(vote === 1)));
    try {
      const response = await fetch("/api/gallery/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoId: photo.id, value: next }) });
      const result = await response.json();
      if (!response.ok) { if (response.status === 401) requestLogin(); throw new Error(result.error); }
      setVote(result.vote); setCount(result.upvotes);
    } catch (error) {
      setVote(previous.vote); setCount(previous.count);
      setError(error instanceof Error && !(error instanceof TypeError) ? error.message : "Your vote couldn’t be saved. Please try again.");
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <article id={`photo-${photo.id}`} className="gallery-card">
    <div className="card-image"><Image src={photo.photo_url} alt={`Avatar shared by ${photo.contributor_name}`} width={400} height={400} unoptimized /><span className="image-tag">{photo.source === "generated" ? "FROM THE STUDIO" : "JUST BE YOU"}</span></div>
    <div className="card-info">
      <h3 title={photo.contributor_name}>{photo.contributor_name}</h3><p>{photo.source === "generated" ? "Made in Image Studio" : "Shared with the community"}</p>
      <div className="card-votes" aria-label="Photo voting" aria-busy={busy}>
        <button type="button" aria-label={`Upvote: ${count} ${count === 1 ? "upvote" : "upvotes"}`} aria-pressed={vote === 1} disabled={busy} onClick={() => void choose(1)} className={`vote-button ${vote === 1 ? "text-blue-600" : vote === -1 ? "text-gray-400" : ""}`}><Thumb /><span>{count}</span></button>
        <button type="button" aria-label="Downvote" aria-pressed={vote === -1} disabled={busy} onClick={() => void choose(-1)} className={`vote-button down ${vote === -1 ? "text-red-600" : vote === 1 ? "text-gray-400" : ""}`}><Thumb down /></button>
      </div>
      {error && <p role="alert" className="form-error">{error}</p>}
    </div>
  </article>;
}

function GalleryFeed({ sort, initial, signedIn, requestLogin }: { sort: GallerySort; initial?: GalleryPage; signedIn: boolean; requestLogin: () => void }) {
  const [items, setItems] = useState(initial?.items ?? []);
  const [cursor, setCursor] = useState(initial?.next_cursor ?? null);
  const [started, setStarted] = useState(Boolean(initial));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sentinel = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; setLoading(true); setError("");
    const abort = new AbortController(); controller.current = abort;
    try {
      const query = new URLSearchParams({ sort }); if (cursor) query.set("cursor", cursor);
      const response = await fetch(`/api/gallery?${query}`, { signal: abort.signal });
      const page = await response.json();
      if (!response.ok) throw new Error(page.error);
      if (abort.signal.aborted) return;
      setItems((existing) => { const ids = new Set(existing.map((item) => item.id)); return [...existing, ...page.items.filter((item: GalleryPhoto) => !ids.has(item.id))]; });
      setCursor(page.next_cursor); setStarted(true);
    } catch (error) {
      if (!abort.signal.aborted) setError(error instanceof Error && !(error instanceof TypeError) ? error.message : "Couldn’t load more photos. Please try again.");
    } finally { if (controller.current === abort) { inFlight.current = false; if (!abort.signal.aborted) setLoading(false); } }
  }, [sort, cursor]);
  useEffect(() => () => { controller.current?.abort(); inFlight.current = false; }, []);
  useEffect(() => {
    if ((started && !cursor) || loading || error || !sentinel.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void load(); }, { rootMargin: "600px" });
    observer.observe(sentinel.current); return () => observer.disconnect();
  }, [started, cursor, loading, error, load]);
  return <>
    <ul aria-label="Avatar gallery" className="gallery-grid">
      {items.map((photo) => <li key={photo.id}><GalleryCard photo={photo} signedIn={signedIn} requestLogin={requestLogin} /></li>)}
    </ul>
    {started && !items.length && !error && <div className="gallery-empty">
      <p className="text-xl font-semibold">{sort === "week" ? "A fresh week, a blank canvas." : "Be the first face in the gallery."}</p>
      <p className="mt-3 text-sm opacity-65">Share an avatar you love and let the votes begin.</p>
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
  const [revision, setRevision] = useState(0);
  const [login, setLogin] = useState(false);
  const [upload, setUpload] = useState(false);
  const [message, setMessage] = useState("");
  const requestLogin = useCallback(() => setLogin(true), []);
  return <main id="main">
    <header className="gallery-hero">
      <div className="hero-copy"><p className="eyebrow"><span aria-hidden="true">✳</span> A PLACE TO BE A LITTLE YOU</p><h1>GOOD FACES. <em>GREAT VIBES.</em></h1><p>Share a face, find a favorite, and make someone smile.</p></div>
      <div className="hero-actions"><button aria-label="Upload photo" onClick={() => userId ? setUpload(true) : requestLogin()} className="action-button">Share your photo <span><Icon name="upload" /></span></button>{userId ? <Link href="/image-studio" className="text-button">Make something new <span aria-hidden="true">↗</span></Link> : <button onClick={requestLogin} className="text-button">Make something new <span aria-hidden="true">↗</span></button>}</div>
    </header>
    <div className="brand-ticker" aria-hidden="true"><span>YOUR FACE. YOUR RULES.</span><span>✳</span><span>A LITTLE LESS SERIOUS.</span><span>✳</span><span>MADE BY YOU, LOVED BY US.</span><span>✳</span></div>
    <section className="gallery-section" aria-labelledby="gallery-title">
      <div className="section-heading"><h2 id="gallery-title">THE GOOD COMPANY.</h2><span className="collection-note">FACES & COUNTING</span></div>
      <div className="filterbar"><div aria-label="Sort gallery" className="gallery-filters">{([["top", "Community favorites", "Top"], ["week", "This week", "Top this week"], ["newest", "Fresh faces", "Newest"]] as const).map(([value, label, accessibleLabel]) => <button key={value} aria-label={accessibleLabel} aria-pressed={sort === value} onClick={() => { if (sort !== value) { setSort(value); setRevision((value) => value + 1); setMessage(""); } }}>{label}</button>)}</div><span className="filter-note">A thumbs-up goes a long way.</span></div>
      {sort === "week" && <p className="filter-explanation">Photos shared since Monday, New York time. Ranked by upvotes.</p>}
      {message && <p role="status" className="gallery-message">{message}</p>}
      <GalleryFeed key={`${sort}:${userId}:${revision}`} sort={sort} initial={sort === "top" && revision === 0 ? initial : undefined} signedIn={Boolean(userId)} requestLogin={requestLogin} />
    </section>
    <section className="bottom-cta"><div><p className="eyebrow">LET YOUR IMAGINATION WANDER</p><h2>A NEW FACE.<br />A NEW POSSIBILITY.</h2></div>{userId ? <Link href="/image-studio" className="action-button">Visit Image Studio <span><Icon name="arrow" /></span></Link> : <button className="action-button" onClick={requestLogin}>Visit Image Studio <span><Icon name="arrow" /></span></button>}<Smile /></section>
    {login && <LoginPrompt close={() => setLogin(false)} />}
    {upload && <UploadPhoto close={() => setUpload(false)} published={() => { setUpload(false); setSort("newest"); setRevision((value) => value + 1); setMessage("Your avatar is live. Welcome to the gallery!"); }} />}
  </main>;
}
