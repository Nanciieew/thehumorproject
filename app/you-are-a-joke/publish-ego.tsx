"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isUuid } from "@/lib/gallery-types";
import styles from "./studio.module.css";

export function PublishEgo({ receipt, snapshot, roast, onBusyChange }: { receipt: string; snapshot: string; roast: string; onBusyChange: (busy: boolean) => void }) {
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
    {open && <dialog ref={dialog} className="design-dialog" aria-labelledby="publish-ego-title" onCancel={e => { e.preventDefault(); close(); }}>
      <h2 id="publish-ego-title">{photoId ? "Your ego is public." : "Publish my ego"}</h2>
      {/* This preview remains in browser memory until public sharing is confirmed. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.publishSnapshot} src={`data:image/jpeg;base64,${snapshot}`} width="320" alt="Your roast snapshot for public sharing" />
      <blockquote className={styles.publishCaption}>{roast}</blockquote>
      {photoId ? <><p role="status">Published to Public Evidence. Gallery votes start at zero.</p><Link href={href} className="ego-button">View in Public Evidence ↗</Link></> : <>
        <p className="ego-note">Your snapshot, roast and profile name will be public. Signed-in people can vote. This doesn’t create a battle.</p>
        <label className="ego-check"><input type="checkbox" checked={approved} disabled={busy} onChange={e => setApproved(e.target.checked)} />I agree to publish this snapshot and roast to Public Evidence.</label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="ego-button" disabled={!approved || busy} onClick={() => void publish()}>{busy ? "Publishing…" : "Publish to Public Evidence"}</button>
      </>}
      <button className="dialog-cancel" disabled={busy} onClick={close}>{photoId ? "Close" : "Cancel"}</button>
    </dialog>}
  </>;
}
