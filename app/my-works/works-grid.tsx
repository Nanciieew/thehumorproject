"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorksPage } from "@/lib/work-types";

export function WorksGrid({ initial }: { initial: WorksPage }) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.next_cursor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sentinel = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (!cursor || request.current) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/my-works?${new URLSearchParams({ cursor })}`, { signal: controller.signal });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (controller.signal.aborted) return;
      const page = data as WorksPage;
      setItems((old) => { const ids = new Set(old.map((work) => work.work_id)); return [...old, ...page.items.filter((work) => !ids.has(work.work_id))]; });
      setCursor(page.next_cursor);
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error && !(error instanceof TypeError) ? error.message : "Couldn’t load more works. Please try again."); }
    finally { if (request.current === controller) { request.current = null; if (!controller.signal.aborted) setBusy(false); } }
  }, [cursor]);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  useEffect(() => {
    if (!cursor || busy || error || !sentinel.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void load(); }, { rootMargin: "500px" });
    observer.observe(sentinel.current); return () => observer.disconnect();
  }, [cursor, busy, error, load]);
  return <>
    {!items.length && <div className="gallery-empty"><p>Your collection starts here.</p><p>Create an image in Image Studio or upload a photo to the gallery.</p><Link href="/image-studio" className="action-button">Create your first work ↗</Link></div>}
    <ul className="gallery-grid" aria-label="My works">{items.map((work) => <li key={work.work_id} className="gallery-card">
      <Link href={`/my-works/${work.work_id}`} aria-label={`Edit ${work.title || "Untitled work"}`}>
        <div className="card-image"><Image src={work.photo_url} alt={work.title || "Untitled work"} width={400} height={400} unoptimized /><span className="image-tag">{work.photo_id ? "PUBLISHED" : "PRIVATE"}</span></div>
        <div className="card-info"><h3 title={work.title || "Untitled work"}>{work.title || "Untitled work"}</h3><p className="work-card-description">{work.description || "Add a name and a story ↗"}</p></div>
      </Link>
    </li>)}</ul>
    <div ref={sentinel} className="gallery-status">
      {busy && <p role="status">Loading your works…</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={() => void load()} className="text-button">Try again</button></div>}
      {!cursor && items.length > 0 && <p>All your works, all yours.</p>}
    </div>
  </>;
}
