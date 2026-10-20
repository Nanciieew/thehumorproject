"use client";

import styles from "./checkboard.module.css";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Work, WorksPage, WorksSort } from "@/lib/work-types";
import { announceVoteChange, VOTES_CHANGED_EVENT } from "@/lib/vote-updates";

type Totals = NonNullable<WorksPage["received"]>;
function VoteThumb({ down = false }: { down?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" style={{ transform: down ? "rotate(180deg)" : undefined }}><path d="M7 10v11H3V10h4Zm1 0 5-8h1a3 3 0 0 1 3 3l-1 4h4a2 2 0 0 1 2 2l-2 8a3 3 0 0 1-3 2H8Z" /></svg>;
}

export function WorksGrid({ initial, onTotalsChange, heading, action }: { initial: WorksPage; onTotalsChange?: (totals: Totals) => void; heading?: ReactNode; action?: ReactNode }) {
  const [sort, setSort] = useState<WorksSort>("top");
  const [deleting, setDeleting] = useState(false);
  return <>
    <div className={styles.collectionHeading}>{heading}<div className={styles.collectionActions}>
      <div className={styles.collectionSort} role="group" aria-label="Sort uploaded memes"><span>Sort</span>{([["top", "Most upvotes"], ["newest", "Newest first"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={sort === value} disabled={deleting} onClick={() => setSort(value)}>{label}</button>)}</div>
      {action}
    </div></div>
    <WorksFeed key={sort} initial={sort === "top" ? initial : undefined} sort={sort} onTotalsChange={onTotalsChange} onDeletingChange={setDeleting} />
  </>;
}

function WorksFeed({ initial, sort, onTotalsChange, onDeletingChange }: { initial?: WorksPage; sort: WorksSort; onTotalsChange?: (totals: Totals) => void; onDeletingChange: (busy: boolean) => void }) {
  const [items, setItems] = useState(initial?.items ?? []);
  const [cursor, setCursor] = useState(initial?.next_cursor ?? null);
  const [started, setStarted] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Work | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const itemsRef = useRef(items);
  const revision = useRef(0), deletingRef = useRef(false), mounted = useRef(false);
  const deleted = useRef(new Set<string>());
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => {
    const element = dialog.current;
    if (selected) element?.showModal();
    return () => { element?.close(); };
  }, [selected]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current?.abort(); request.current = null; onDeletingChange(false); };
  }, [onDeletingChange]);
  const refresh = useCallback(async () => {
    if (request.current || deletingRef.current || document.visibilityState === "hidden") return;
    const controller = new AbortController(); request.current = controller;
    const version = revision.current;
    try {
      const refreshed = new Map<string, Work>(); let next: string | null = null;
      const pages = Math.max(1, Math.ceil(itemsRef.current.length / 30));
      let received: Totals | undefined;
      for (let index = 0; index < pages; index++) {
        const query = new URLSearchParams({ sort }); if (next) query.set("cursor", next);
        const response = await fetch(`/api/my-works?${query}`, { signal: controller.signal, cache: "no-store" });
        const page = await response.json() as WorksPage & { error?: string };
        if (!response.ok) throw new Error(page.error || "Couldn’t refresh your memes.");
        for (const work of page.items) if (!deleted.current.has(work.work_id)) refreshed.set(work.work_id, work);
        received = page.received; next = page.next_cursor;
        if (!next) break;
      }
      if (!controller.signal.aborted && version === revision.current) {
        setItems([...refreshed.values()]); setCursor(next); setStarted(true); setError("");
        if (received) onTotalsChange?.(received);
      }
    } catch { if (!controller.signal.aborted) setError("Couldn’t refresh your memes. Please try again."); }
    finally { if (request.current === controller) request.current = null; }
  }, [sort, onTotalsChange]);
  useEffect(() => {
    const update = () => { void refresh(); };
    const timer = window.setInterval(update, 15_000);
    window.addEventListener("focus", update); window.addEventListener("storage", update); window.addEventListener(VOTES_CHANGED_EVENT, update);
    document.addEventListener("visibilitychange", update);
    // Re-entering a sort also picks up changes since its initial server render.
    update();
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); window.removeEventListener("storage", update); window.removeEventListener(VOTES_CHANGED_EVENT, update); document.removeEventListener("visibilitychange", update); };
  }, [refresh]);
  const load = useCallback(async () => {
    if ((!cursor && started) || request.current || deletingRef.current) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError("");
    const version = revision.current;
    try {
      const query = new URLSearchParams({ sort }); if (cursor) query.set("cursor", cursor);
      const response = await fetch(`/api/my-works?${query}`, { signal: controller.signal, cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (controller.signal.aborted || version !== revision.current) return;
      const page = data as WorksPage;
      setItems(old => { const ids = new Set(old.map(work => work.work_id)); return [...old, ...page.items.filter(work => !ids.has(work.work_id) && !deleted.current.has(work.work_id))]; });
      setCursor(page.next_cursor); setStarted(true);
      if (page.received) onTotalsChange?.(page.received);
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error && !(error instanceof TypeError) ? error.message : "Couldn’t load more works. Please try again."); }
    finally { if (request.current === controller) { request.current = null; if (!controller.signal.aborted) setBusy(false); } }
  }, [cursor, sort, started, onTotalsChange]);
  useEffect(() => {
    if ((!cursor && started) || busy || error || !sentinel.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void load(); }, { rootMargin: "500px" });
    observer.observe(sentinel.current); return () => observer.disconnect();
  }, [cursor, started, busy, error, load]);
  function close() { if (!deletingRef.current) { setSelected(null); setDeleteError(""); } }
  async function remove() {
    if (!selected || deletingRef.current) return;
    deletingRef.current = true; onDeletingChange(true); setDeleting(true); setDeleteError(""); revision.current++;
    request.current?.abort(); request.current = null; setBusy(false);
    try {
      const response = await fetch(`/api/my-works/${selected.work_id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true }) });
      const result = await response.json();
      if (!response.ok || result.deleted !== true) throw new Error(result.error || "Couldn’t delete this meme. Please try again.");
      if (!mounted.current) return;
      deleted.current.add(selected.work_id); setItems(old => old.filter(work => work.work_id !== selected.work_id)); setSelected(null);
      deletingRef.current = false; announceVoteChange();
    } catch (cause) { if (mounted.current) setDeleteError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "Couldn’t delete this meme. Please try again."); }
    finally { deletingRef.current = false; if (mounted.current) { setDeleting(false); onDeletingChange(false); } }
  }
  return <>
    {started && !items.length && <div className="gallery-empty"><p>Your collection starts here.</p><p>Create a meme in Checked Factory to start your collection.</p><Link href="/disguise" className="action-button">Create new meme ↗</Link></div>}
    <ul className="gallery-grid" aria-label="My works">{items.map(work => <li key={work.work_id} className="gallery-card">
      <Link href={`/my-works/${work.work_id}`} aria-label={`Edit ${work.title || "Untitled work"}`}>
        <div className="card-image"><Image src={work.photo_url} alt={work.title || "Untitled work"} width={400} height={400} unoptimized />{!work.photo_id && <span className="image-tag">PRIVATE</span>}</div>
      </Link>
      <div className={styles.workVotes}>
        <span aria-label={`${work.upvotes ?? "0"} upvotes received`}><VoteThumb />{BigInt(work.upvotes ?? "0").toLocaleString("en-US")}</span>
        <span aria-label={`${work.downvotes ?? "0"} downvotes received`}><VoteThumb down />{BigInt(work.downvotes ?? "0").toLocaleString("en-US")}</span>
        <button className={styles.deleteMeme} aria-label={`Delete ${work.title || "Untitled work"}`} title="Delete meme" onClick={() => { setDeleteError(""); setSelected(work); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></svg></button>
      </div>
    </li>)}</ul>
    <div ref={sentinel} className="gallery-status">
      {busy && <p role="status">Loading your works…</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={() => void refresh()} className="text-button">Try again</button></div>}
    </div>
    {selected && <dialog ref={dialog} className="design-dialog" aria-labelledby="delete-meme-title" onCancel={event => { event.preventDefault(); close(); }}>
      <h2 id="delete-meme-title">Delete this meme?</h2>
      <p className={styles.deleteNote}>“{selected.title || "Untitled work"}” will be permanently removed from your Checkboard and Checked Gallery, along with its votes. This cannot be undone.</p>
      {deleteError && <p role="alert" className="form-error">{deleteError}</p>}
      <button className={styles.confirmDelete} disabled={deleting} onClick={() => void remove()}>{deleting ? "Deleting…" : "Delete permanently"}</button>
      <button className="dialog-cancel" disabled={deleting} onClick={close}>Cancel</button>
    </dialog>}
  </>;
}
