"use client";

import Link from "next/link";
import { useRef, useState } from "react";

export function PublishButton({ generationId, published = false }: { generationId: string; published?: boolean }) {
  const [done, setDone] = useState(published);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function publish() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/gallery/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId: generationId, source: "generated" }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setDone(true);
    } catch (error) { setError(error instanceof Error && !(error instanceof TypeError) ? error.message : "Couldn’t publish your photo. Please try again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="mt-4">
    {done ? <p role="status" className="text-sm">Published to Avatar Gallery. <Link href="/" className="underline">View gallery ↗</Link></p> : <>
      <p className="mb-3 text-xs opacity-65">Publishing shares this photo and your full name publicly.</p>
      <button disabled={busy} onClick={() => void publish()} className="action-button">{busy ? "Publishing…" : "Publish to gallery"}</button>
    </>}
    {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
  </div>;
}
