"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isUuid } from "@/lib/gallery-types";
import styles from "./studio.module.css";
import modal from "./publish-ego.module.css";

export function PublishEgo({ receipt, snapshot, onBusyChange }: { receipt: string; snapshot: string; roast: string; onBusyChange: (busy: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photoId, setPhotoId] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const resultLink = useRef<HTMLAnchorElement>(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    const element = dialog.current;
    if (open) element?.showModal();
    return () => { element?.close(); };
  }, [open]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; onBusyChange(false); };
  }, [onBusyChange]);
  const href = `/gallery?sort=newest#photo-${photoId}`;
  function close() {
    if (inFlight.current) return;
    dialog.current?.close(); setOpen(false); setApproved(false); setError("");
    (resultLink.current ?? button.current)?.focus();
  }
  async function publish() {
    if (!approved || inFlight.current || photoId) return;
    inFlight.current = true; setBusy(true); onBusyChange(true); setError("");
    try {
      const response = await fetch("/api/roast/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receipt, snapshot, approved: true }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn’t publish your ego. Please try again.");
      if (!isUuid(result.photoId)) throw new Error("Couldn’t confirm publication. Please try again.");
      if (mounted.current) setPhotoId(result.photoId);
    } catch (e) { if (mounted.current) setError(e instanceof Error && !(e instanceof TypeError) ? e.message : "Couldn’t publish your ego. Please try again."); }
    finally { inFlight.current = false; if (mounted.current) { setBusy(false); onBusyChange(false); } }
  }
  return <>
    {photoId ? <Link ref={resultLink} href={href} className={`${styles.challengeButton} ${styles.publishButton}`}>View my ego ↗</Link> : <button ref={button} className={`${styles.challengeButton} ${styles.publishButton}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>Publish my ego</button>}
    {open && <dialog ref={dialog} className={modal.dialog} aria-labelledby="publish-ego-title" onCancel={e => { e.preventDefault(); close(); }}>
      <header className={modal.header}>
        <h2 id="publish-ego-title">{photoId ? "Your ego is public." : "Publish my ego"}</h2>
        <button className={modal.close} aria-label="Close publish window" disabled={busy} onClick={close}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 5 14 14M19 5 5 19" /></svg></button>
      </header>
      <div className={modal.evidence}>
        <div className={modal.photo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/webp;base64,${snapshot}`} alt="Your roast snapshot for public sharing" />
        </div>
        <span className={modal.clip} aria-hidden="true"><svg viewBox="0 0 24 30" fill="none"><path d="M8 3h10v8" /><path d="m6 18 4 4 9-11" /></svg></span>
      </div>
      <div className={modal.details}>
        {photoId ? <p role="status">Published to Checked Gallery. Gallery votes start at zero.</p> : <>
          <p>Your screenshot and profile name will be public.</p>
          <label className={modal.consent}><input type="checkbox" checked={approved} disabled={busy} onChange={e => setApproved(e.target.checked)} /><span>I agree to share this meme in Checked Gallery.</span></label>
          {error && <p role="alert" className={modal.error}>{error}</p>}
        </>}
      </div>
      <footer className={modal.actions}>
        <button className={modal.cancel} disabled={busy} onClick={close}>{photoId ? "Close" : "Cancel"}</button>
        {photoId ? <Link href={href} className={modal.publish}>View in Checked Gallery ↗</Link> : <button className={modal.publish} aria-label="Publish to Checked Gallery" disabled={!approved || busy} onClick={() => void publish()}>{busy ? "Publishing…" : "Publish my ego"}</button>}
      </footer>
    </dialog>}
  </>;
}
