"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Work } from "@/lib/work-types";

export function CaptionEditor({ work }: { work: Work }) {
  const [title, setTitle] = useState(work.title);
  const [description, setDescription] = useState(work.description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const inFlight = useRef(false);
  const router = useRouter();
  async function save() {
    if (inFlight.current) return;
    if (title.trim().length > 100 || description.trim().length > 1000) { setError("Use up to 100 characters for the name and 1,000 for the description."); return; }
    inFlight.current = true; setBusy(true); setSaved(false); setError("");
    try {
      const response = await fetch(`/api/my-works/${work.work_id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setTitle(result.title); setDescription(result.description); setSaved(true); router.refresh();
    } catch (error) { setError(error instanceof Error && !(error instanceof TypeError) ? error.message : "Couldn’t save your captions. Please try again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <form className="caption-editor" noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <label htmlFor="work-title">Work name <span>{title.length}/100</span></label>
    <input id="work-title" name="title" maxLength={100} value={title} disabled={busy} placeholder="Give your work a name" onChange={(event) => { setTitle(event.target.value); setSaved(false); }} />
    <label htmlFor="work-description">Description <span>{description.length}/1,000</span></label>
    <textarea id="work-description" name="description" maxLength={1000} rows={7} value={description} disabled={busy} placeholder="What’s the story behind this work?" onChange={(event) => { setDescription(event.target.value); setSaved(false); }} />
    {error && <p role="alert" className="form-error">{error}</p>}
    {saved && <p role="status" className="form-success">Your captions have been saved.</p>}
    <button disabled={busy} className="action-button">{busy ? "Saving…" : "Save changes"}</button>
  </form>;
}
