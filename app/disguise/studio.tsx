"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { peekDisguiseDraft, clearDisguiseDraft } from "@/lib/disguise-draft";
import { isUuid } from "@/lib/gallery-types";
import { PhotoInput } from "../photo-input";
import styles from "./studio.module.css";

const presets = [
  ["3D cartoon", "3D animated-film character, oversized expressive eyes, mischievous grin, acid-yellow jacket, dark studio backdrop."],
  ["Anime", "Hand-drawn anime protagonist, dramatic ink lines, wind-swept hair, cinematic colors and a rebellious pose."],
  ["Comic book", "Graphic-novel antihero, bold black outlines, halftone shading, acid-yellow accents and an absurdly confident pose."],
  ["Claymation", "Handmade clay-animation character, visible sculpted textures, expressive face and a comically oversized ego."],
];
type Result = { generationId: string; url: string };
export function DisguiseStudio({ configured }: { configured: boolean }) {
  const [source, setSource] = useState<{ image: string; name: string } | null>(() => peekDisguiseDraft());
  const [fileName, setFileName] = useState(source?.name ?? "");
  const [prompt, setPrompt] = useState(presets[0][1]);
  const [consent, setConsent] = useState(false);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publicApproval, setPublicApproval] = useState(false);
  const [photoId, setPhotoId] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [publishError, setPublishError] = useState("");
  const generation = useRef(0), fileVersion = useRef(0);
  const request = useRef<AbortController | null>(null);
  const reader = useRef<FileReader | null>(null);
  const active = useRef(false), inFlight = useRef(false), publishingRef = useRef(false);
  useEffect(() => { if (source) clearDisguiseDraft(source.image); }, [source]);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; request.current?.abort(); reader.current?.abort(); };
  }, []);
  function choosePhoto(file: File | null) {
    const token = ++fileVersion.current; reader.current?.abort();
    setSource(null); setConsent(false); setResult(null); setPhotoId(""); setPublicApproval(false); setError(""); setReading(false);
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || !file.size || file.size > 2 * 1024 * 1024) { setError("Choose a JPG or PNG selfie up to 2 MB."); return; }
    setReading(true);
    const next = new FileReader(); reader.current = next;
    next.onload = () => {
      if (!active.current || token !== fileVersion.current) return;
      setReading(false);
      if (typeof next.result !== "string") { setError("Couldn’t read this photo. Choose another file."); return; }
      setSource({ image: next.result, name: file.name });
    };
    next.onerror = () => { if (active.current && token === fileVersion.current) { setReading(false); setError("Couldn’t read this photo. Choose another file."); } };
    next.readAsDataURL(file);
  }
  function cancel() {
    generation.current++; request.current?.abort(); request.current = null; inFlight.current = false; setBusy(false);
    setError("Generation cancelled. Any result already completed is saved in My Damage Report.");
  }
  async function generate() {
    if (inFlight.current || !source || !consent || !prompt.trim() || !configured) return;
    const token = ++generation.current; const controller = new AbortController(); request.current = controller;
    inFlight.current = true; setBusy(true); setError(""); setResult(null); setPhotoId(""); setPublicApproval(false); setPublishError("");
    try {
      const response = await fetch("/api/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose: "disguise", image: source.image, prompt: prompt.trim(), approved: true }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(180_000)]) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn’t generate your character. Please try again.");
      if (!isUuid(data.generationId) || typeof data.url !== "string" || !data.url.startsWith("https://")) throw new Error("The generated preview is unavailable. Check My Damage Report.");
      if (active.current && token === generation.current) setResult({ generationId: data.generationId, url: data.url });
    } catch (e) { if (active.current && token === generation.current && !controller.signal.aborted) setError(e instanceof Error && !(e instanceof TypeError) ? e.message : "Couldn’t generate your character. Please try again."); }
    finally { if (active.current && token === generation.current) { inFlight.current = false; request.current = null; setBusy(false); } }
  }
  async function publish() {
    if (!result || !publicApproval || publishingRef.current || photoId) return;
    publishingRef.current = true; setPublishing(true); setPublishError("");
    try {
      const response = await fetch("/api/gallery/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId: result.generationId, source: "generated" }) });
      const data = await response.json();
      if (!response.ok || !isUuid(data.photoId)) throw new Error(data.error || "Couldn’t publish this character. Please try again.");
      if (active.current) setPhotoId(data.photoId);
    } catch (e) { if (active.current) setPublishError(e instanceof Error && !(e instanceof TypeError) ? e.message : "Couldn’t publish this character. Please try again."); }
    finally { publishingRef.current = false; if (active.current) setPublishing(false); }
  }
  const locked = busy || publishing;
  return <main id="main" className="ego-page">
    <header className="ego-hero"><p className="eyebrow">DISGUISE MY EGO</p><h1>New face.<br /><em>Same problem.</em></h1><p>Turn your selfie into a cartoon character. The ego comes free.</p></header>
    <div className={styles.layout}>
      <section className={`ego-panel ${styles.panel}`} aria-label="Character settings">
        <h2>Pick your alibi.</h2>
        <p className="ego-note">Your selfie</p>
        {source ? <div className={styles.source}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={source.image} width="160" height="160" alt="Selfie selected for your character" />
          <button className="secondary-button" disabled={locked} onClick={() => { fileVersion.current++; reader.current?.abort(); setSource(null); setConsent(false); setFileName(""); }}>Remove photo</button>
        </div> : <div className={styles.photoPlaceholder}>{reading ? "Reading your photo…" : "Your face. For reference."}</div>}
        <PhotoInput fileName={fileName} onSelect={setFileName} onFile={choosePhoto} accept="image/jpeg,image/png" disabled={locked} label="Choose selfie" describedBy="disguise-photo-help" />
        <p id="disguise-photo-help" className="ego-note">JPG or PNG · Up to 2 MB</p>
        <div className={styles.presets} role="group" aria-label="Character style">{presets.map(([name, value]) => <button key={name} disabled={locked} aria-pressed={prompt === value} onClick={() => setPrompt(value)}>{name}</button>)}</div>
        <label htmlFor="disguise-prompt">Describe your character</label>
        <textarea id="disguise-prompt" rows={5} maxLength={4000} value={prompt} disabled={locked} onChange={e => setPrompt(e.target.value)} />
        <label className="ego-check"><input type="checkbox" checked={consent} disabled={locked || !source} onChange={e => setConsent(e.target.checked)} />I agree to send this selfie and prompt to Doubao to generate my character.</label>
        {!configured && <p role="alert">Image generation is not configured yet.</p>}
        {error && <p role="alert">{error}</p>}
        <button className="ego-button" disabled={!configured || !source || !consent || !prompt.trim() || reading || locked} onClick={() => void generate()}>{busy ? "Building your alibi…" : "Give my ego a disguise ↗"}</button>
        {busy && <button className="ego-link" onClick={cancel}>Cancel generation</button>}
        <p className="ego-note">The generated image saves privately to My Damage Report.</p>
      </section>
      <section className={`ego-panel ${styles.panel} ${styles.result}`} aria-label="Generated character" aria-busy={busy}>
        <div className={styles.resultHeading}><h2>Your new alibi.</h2><span className="ego-stamp">{photoId ? "PUBLIC" : "PRIVATE"}</span></div>
        {result ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.generated} src={result.url} width="768" height="768" alt="Your generated cartoon character" />
          <p role="status" className="ego-note">{photoId ? "Published to Public Evidence." : "Saved privately to My Damage Report."}</p>
          <Link className="ego-link" href={`/my-works/${result.generationId}`}>View saved ego ↗</Link>
          {photoId ? <Link className="ego-button" href={`/gallery?sort=newest#photo-${photoId}`}>View in Public Evidence ↗</Link> : <details className={styles.share}><summary>Put this ego on display ↗</summary><p className="ego-note">This publishes the generated character and your profile name.</p><label className="ego-check"><input type="checkbox" checked={publicApproval} disabled={publishing} onChange={e => setPublicApproval(e.target.checked)} />I agree to publish this character to Public Evidence.</label>{publishError && <p role="alert">{publishError}</p>}<button className="ego-button" disabled={!publicApproval || publishing} onClick={() => void publish()}>{publishing ? "Publishing…" : "Publish my disguise ↗"}</button></details>}
        </> : <div className={styles.empty} data-busy={busy}>
          <svg aria-hidden="true" viewBox="0 0 240 240" fill="none"><path d="M53 121C53 55 76 24 120 24s67 31 67 97c0 63-25 99-67 99s-67-36-67-99Z" stroke="currentColor" strokeWidth="2" strokeDasharray="12 8" /><path d="m63 84 57 18 57-18v55l-57-17-57 17Z" fill="currentColor" /><ellipse cx="89" cy="111" rx="9" ry="6" fill="var(--background)" /><ellipse cx="151" cy="111" rx="9" ry="6" fill="var(--background)" /><path d="M92 168c17 18 39 18 56 0" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>
          <h3>{busy ? "Identity crisis in progress." : "Suspiciously better looking."}</h3><p role="status">{busy ? "Generating your character. This can take a minute." : "Your character appears here."}</p>
        </div>}
      </section>
    </div>
  </main>;
}
