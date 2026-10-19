"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { peekDisguiseDraft, clearDisguiseDraft } from "@/lib/disguise-draft";
import { isUuid } from "@/lib/gallery-types";
import type { FactoryPreview } from "@/lib/factory/types";
import { PhotoInput } from "../photo-input";
import styles from "./studio.module.css";

export function DisguiseStudio({ configured, userId }: { configured: boolean; userId: string }) {
  const [source, setSource] = useState<{ image: string; name: string } | null>(() => peekDisguiseDraft());
  const [fileName, setFileName] = useState("");
  const [direction, setDirection] = useState("");
  const [consent, setConsent] = useState(false);
  const [approved, setApproved] = useState(false);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<FactoryPreview | null>(null);
  const [selected, setSelected] = useState(0);
  const [photoId, setPhotoId] = useState("");
  const [error, setError] = useState("");
  const [publishError, setPublishError] = useState("");
  const [recoverable, setRecoverable] = useState(false);
  const request = useRef<AbortController | null>(null);
  const reader = useRef<FileReader | null>(null);
  const mounted = useRef(false), inFlight = useRef(false), publishingRef = useRef(false);
  const batchId = useRef<string | null>(null), version = useRef(0);
  const storageKey = `checked:factory-batch:${userId}`;
  function remember(id: string | null) {
    batchId.current = id;
    try { if (id) sessionStorage.setItem(storageKey, id); else sessionStorage.removeItem(storageKey); } catch { /* The active batch still works without storage. */ }
  }
  function acceptPreview(data: FactoryPreview) {
    if (!isUuid(data.id) || !Array.isArray(data.variants) || data.variants.length !== 5 || data.variants.some(variant => typeof variant.caption !== "string" || typeof variant.url !== "string" || (variant.url && !variant.url.startsWith("https://")))) throw new Error("The previews couldn’t be loaded. Please try again.");
    setResult(data); setSelected(data.selected ?? 0); setConfirmed(data.selected !== null); setPhotoId(data.photoId ?? ""); setRecoverable(false);
  }
  const restore = useCallback(async (id: string, signal?: AbortSignal) => {
    const token = version.current;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/factory/${id}`, { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn’t restore your previews.");
      if (mounted.current && token === version.current && !signal?.aborted) acceptPreview(data);
    } catch (cause) {
      if (mounted.current && token === version.current && !signal?.aborted) { setError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "Couldn’t load your previews. Please try again."); setRecoverable(true); }
    } finally { if (mounted.current && token === version.current && !signal?.aborted) setBusy(false); }
  }, []);
  useEffect(() => { if (source) clearDisguiseDraft(source.image); }, [source]);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    let savedId: string | null = null;
    try { savedId = sessionStorage.getItem(storageKey); } catch { /* Browser storage is optional. */ }
    const timer = window.setTimeout(() => {
      if (isUuid(savedId) && !inFlight.current) { batchId.current = savedId; void restore(savedId, controller.signal); }
    }, 0);
    return () => { mounted.current = false; window.clearTimeout(timer); controller.abort(); request.current?.abort(); reader.current?.abort(); };
  }, [storageKey, restore]);
  useEffect(() => {
    if (!result) return;
    const previews = result.variants.filter(variant => variant.url).map(variant => {
      const image = new window.Image(); image.src = variant.url; return image;
    });
    return () => { for (const image of previews) image.src = ""; };
  }, [result]);
  async function discard(id: string) {
    const response = await fetch(`/api/factory/${id}`, { method: "DELETE" });
    if (!response.ok && response.status !== 404 && response.status !== 410) {
      const data = await response.json(); throw new Error(data.error || "Couldn’t clear the previous previews. Please retry.");
    }
  }
  function choosePhoto(file: File | null) {
    const token = ++version.current; reader.current?.abort();
    setSource(null); setResult(null); setPhotoId(""); setConfirmed(false); setApproved(false); setConsent(false); setError(""); setReading(false);
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || !file.size || file.size > 2 * 1024 * 1024) { setError("Choose a JPG or PNG meme picture up to 2 MB."); return; }
    setReading(true);
    const next = new FileReader(); reader.current = next;
    next.onload = () => {
      if (!mounted.current || token !== version.current) return;
      setReading(false);
      if (typeof next.result !== "string") { setError("Couldn’t read that picture. Try another file."); return; }
      setSource({ image: next.result, name: file.name });
    };
    next.onerror = () => { if (mounted.current && token === version.current) { setReading(false); setError("Couldn’t read that picture. Try another file."); } };
    next.readAsDataURL(file);
  }
  async function generate() {
    if (!source || !consent || !configured || inFlight.current || publishingRef.current) return;
    inFlight.current = true; setBusy(true); setGenerating(true); setError(""); setPublishError("");
    const token = ++version.current;
    const controller = new AbortController(); request.current = controller;
    try {
      if (batchId.current) await discard(batchId.current);
      if (!mounted.current || token !== version.current) return;
      setResult(null); setPhotoId(""); setConfirmed(false); setApproved(false); setRecoverable(false);
      const id = crypto.randomUUID(); remember(id);
      const response = await fetch("/api/factory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, image: source.image, direction: direction.trim(), approved: true }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(190_000)]) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn’t generate your memes. Please try again.");
      if (mounted.current && token === version.current) acceptPreview(data);
    } catch (cause) {
      if (mounted.current && token === version.current && !controller.signal.aborted) { setError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "Couldn’t finish this batch. Try loading its previews before generating again."); setRecoverable(!!batchId.current); }
    } finally { if (mounted.current && token === version.current) { inFlight.current = false; setBusy(false); setGenerating(false); request.current = null; } }
  }
  async function cancel() {
    version.current++; request.current?.abort(); inFlight.current = false;
    const id = batchId.current;
    setBusy(false); setGenerating(false); setError("Generation cancelled.");
    if (id) try { await discard(id); remember(null); setRecoverable(false); } catch { setError("Generation stopped here. Cached previews will expire automatically."); }
  }
  async function publish() {
    if (!result || !approved || publishingRef.current || photoId || busy) return;
    publishingRef.current = true; setPublishing(true); setConfirmed(true); setPublishError("");
    const index = selected;
    try {
      const response = await fetch(`/api/factory/${result.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selected: index, approved: true }) });
      const data = await response.json();
      if (!response.ok || !isUuid(data.photoId)) throw new Error(data.error || "Couldn’t publish your meme. Please retry.");
      if (mounted.current) {
        setPhotoId(data.photoId);
        setResult(previous => previous ? { ...previous, selected: index, photoId: data.photoId, variants: previous.variants.map((variant, position) => position === index ? variant : { ...variant, url: "" }) } : previous);
        try { sessionStorage.setItem("checked:gallery-votes-changed", "1"); } catch { /* The gallery also refreshes on focus. */ }
      }
    } catch (cause) { if (mounted.current) setPublishError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "Publishing could not be confirmed. Retry with this caption to finish publishing and cleanup."); }
    finally { publishingRef.current = false; if (mounted.current) setPublishing(false); }
  }
  const locked = busy || publishing;
  const variant = result?.variants[selected];
  return <main id="main" className={styles.factory}>
    <header className={styles.hero}><p className={styles.eyebrow}>CHECKED FACTORY</p><h1>Your picture.<br /><em>Five ways to get checked.</em></h1><p>Upload a meme picture. We’ll find five punchlines and make five finished memes. You pick the keeper.</p></header>
    <section className={styles.upload} aria-labelledby="upload-title">
      <div><h2 id="upload-title">01 / Supply the evidence</h2><PhotoInput fileName={fileName} onSelect={setFileName} onFile={choosePhoto} accept="image/jpeg,image/png" disabled={locked || reading} label="Choose meme picture" describedBy="factory-photo-help" /><p id="factory-photo-help" className={styles.note}>JPG or PNG · Up to 2 MB</p></div>
      <div className={styles.direction}><label htmlFor="factory-direction">Give the jokes a direction <span>(optional)</span></label><input id="factory-direction" maxLength={500} placeholder="e.g. finals week, awkward dates, office life…" value={direction} disabled={locked} onChange={event => { setDirection(event.target.value); setConsent(false); }} /></div>
      <div className={styles.generate}><label className={styles.consent}><input type="checkbox" checked={consent} disabled={!source || locked} onChange={event => setConsent(event.target.checked)} />Send this picture to Gemini for captions and Doubao for five captioned images.</label><button className={styles.primary} disabled={!configured || !source || !consent || reading || locked} onClick={() => void generate()}>{busy ? "Making your five memes…" : result ? "Generate five new memes ↗" : "Generate five memes ↗"}</button>{generating && <button className={styles.textButton} onClick={() => void cancel()}>Cancel generation</button>}</div>
    </section>
    {!configured && <p role="alert" className={styles.error}>Caption and image generation must both be configured.</p>}
    {error && <div role="alert" className={styles.error}><p>{error}</p>{recoverable && !busy && <button className={styles.textButton} onClick={() => { if (batchId.current) void restore(batchId.current); }}>Load cached previews</button>}</div>}
    <div className={styles.workspace}>
      <section className={styles.preview} aria-label="Meme preview" aria-busy={busy}>
        <div className={styles.panelHeader}><h2>02 / The meme</h2><span>{photoId ? "PUBLISHED" : result ? "PRIVATE PREVIEW" : "YOUR ORIGINAL"}</span></div>
        {variant?.url || source ? <div className={styles.picture}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={variant?.url || source?.image} src={variant?.url || source?.image} width="720" height="720" alt={variant ? `AI-generated meme: ${variant.caption}` : "Your uploaded meme picture"} />
          {busy && <div className={styles.working} role="status"><span>✳</span><p>Writing five punchlines.<br />Generating five finished memes.</p><small>This can take a few minutes.</small></div>}
        </div> : <div className={styles.empty}><span aria-hidden="true">✳</span><h3>{busy ? "Five punchlines in production." : "A picture is worth five punchlines."}</h3><p role="status">{reading ? "Reading your picture…" : busy ? "Generating your memes. This can take a few minutes." : "Upload your picture to get started."}</p></div>}
        {variant && <p className={styles.note}>AI-generated image · Bottom caption · White lettering, black outline · Caption {selected + 1} of 5</p>}
      </section>
      <section className={styles.captions} aria-labelledby="captions-title"><div className={styles.panelHeader}><h2 id="captions-title">03 / Pick your punchline</h2><span>5 OPTIONS</span></div>
        <p className={styles.note}>{photoId ? "Your keeper is live. The four unused images were deleted." : "Every caption has its own generated image. Click to try it on."}</p>
        {result ? <div className={styles.options} role="group" aria-label="Choose a caption">{result.variants.map((option, index) => <button key={index} className={styles.option} aria-pressed={selected === index} disabled={locked || confirmed || !!photoId} onClick={() => { setSelected(index); setApproved(false); }}><span className={styles.number}>{String(index + 1).padStart(2, "0")}</span><span>{option.caption}</span><span className={styles.selected} aria-hidden="true">{selected === index ? "✓" : "↗"}</span></button>)}</div> : <div className={styles.placeholders} aria-label="Captions appear after generation">{Array.from({ length: 5 }, (_, index) => <div key={index}><span>{String(index + 1).padStart(2, "0")}</span><i /><i /></div>)}</div>}
        {result && !photoId && <div className={styles.publish}><label className={styles.consent}><input type="checkbox" checked={approved} disabled={locked} onChange={event => setApproved(event.target.checked)} />Publish this meme and my profile name to Checked Gallery. Delete the other four images.</label>{confirmed && !publishing && <p className={styles.note}>This caption is confirmed. Retry publishing to finish safely.</p>}{publishError && <p role="alert" className={styles.error}>{publishError}</p>}<button className={styles.primary} disabled={!approved || locked} onClick={() => void publish()}>{publishing ? "Publishing & clearing previews…" : confirmed ? "Retry publishing & cleanup" : "Keep this meme & publish ↗"}</button><p className={styles.note}>Previews are cached privately for 24 hours. Only your chosen meme stays in My Checkboard after publishing.</p></div>}
        {photoId && <div className={styles.success}><p role="status">Published to Checked Gallery. Four unused previews deleted.</p><Link className={styles.primary} href={`/gallery?sort=newest#photo-${photoId}`}>See my meme ↗</Link><Link className={styles.textButton} href={`/my-works/${photoId}`}>View in My Checkboard</Link></div>}
      </section>
    </div>
  </main>;
}
