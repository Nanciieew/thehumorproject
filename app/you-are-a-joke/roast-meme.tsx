"use client";

import { useEffect, useState } from "react";
import { saveCheckedMeme, type CachedCheckedMeme } from "@/lib/checked-meme-cache";
import { PublishEgo } from "./publish-ego";
import styles from "./studio.module.css";

export function RoastMeme({ receipt, snapshot, roast, onBusyChange, generated = false, userId, onGenerated }: { receipt: string; snapshot: string; roast: string; onBusyChange: (busy: boolean) => void; generated?: boolean; userId?: string; onGenerated?: (result: CachedCheckedMeme) => void }) {
  const [result, setResult] = useState<{ receipt: string; snapshot: string } | null>(generated ? { receipt, snapshot } : null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (generated) { onGenerated?.({ receipt, snapshot, roast }); return; }
    const controller = new AbortController();
    onBusyChange(true);
    void fetch("/api/roast/meme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receipt, snapshot }), signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || typeof data.receipt !== "string" || typeof data.snapshot !== "string") throw new Error(data.error || "Couldn’t generate your meme.");
        if (!controller.signal.aborted) { setResult(data); onGenerated?.({ receipt: data.receipt, snapshot: data.snapshot, roast }); if (userId) void saveCheckedMeme(userId, { receipt: data.receipt, snapshot: data.snapshot, roast }); }
      }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "Couldn’t generate your meme. Please retry."); })
      .finally(() => { if (!controller.signal.aborted) onBusyChange(false); });
    return () => { controller.abort(); onBusyChange(false); };
  }, [receipt, snapshot, attempt, onBusyChange, generated, userId, roast, onGenerated]);
  if (!result && !error) return null;
  return <div className={styles.memeResult}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {result && <img src={`data:image/webp;base64,${result.snapshot}`} alt="Your checked screenshot" />}
    <div className={styles.memeActions} hidden={!!result && !!onGenerated}>
      {result ? onGenerated ? null : <PublishEgo {...result} roast={roast} onBusyChange={onBusyChange} /> : error ? <><p role="alert">{error}</p><button className={styles.challengeButton} onClick={() => { setError(""); setResult(null); setAttempt(value => value + 1); }}>Retry image generation</button></> : null}
    </div>
  </div>;
}
