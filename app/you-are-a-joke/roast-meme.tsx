"use client";

import { useEffect, useState } from "react";
import { PublishEgo } from "./publish-ego";
import styles from "./studio.module.css";

export function RoastMeme({ receipt, snapshot, roast, onBusyChange }: { receipt: string; snapshot: string; roast: string; onBusyChange: (busy: boolean) => void }) {
  const [result, setResult] = useState<{ receipt: string; snapshot: string } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    onBusyChange(true);
    void fetch("/api/roast/meme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receipt, snapshot }), signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || typeof data.receipt !== "string" || typeof data.snapshot !== "string") throw new Error(data.error || "Couldn’t generate your meme.");
        if (!controller.signal.aborted) setResult(data);
      }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "Couldn’t generate your meme. Please retry."); })
      .finally(() => { if (!controller.signal.aborted) onBusyChange(false); });
    return () => { controller.abort(); onBusyChange(false); };
  }, [receipt, snapshot, attempt, onBusyChange]);
  return <div className={styles.memeResult}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`data:image/${result ? "webp" : "jpeg"};base64,${result?.snapshot ?? snapshot}`} alt={result ? `Your screenshot with the punchline: ${roast}` : "The screenshot captured for your punchline"} />
    <div className={styles.memeActions}>
      {result ? <PublishEgo {...result} roast={roast} onBusyChange={onBusyChange} /> : error ? <><p role="alert">{error}</p><button className={styles.challengeButton} onClick={() => { setError(""); setResult(null); setAttempt(value => value + 1); }}>Retry image generation</button></> : <p role="status">Adding your punchline to the screenshot…</p>}
    </div>
  </div>;
}
