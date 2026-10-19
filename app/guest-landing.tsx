"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./guest-landing.module.css";

export function GuestLanding() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const [phase, setPhase] = useState<"off" | "asking" | "on">("off");
  const [error, setError] = useState("");

  const release = useCallback(() => {
    generation.current++;
    stream.current?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  const stop = useCallback(() => { release(); setPhase("off"); }, [release]);

  const openMirror = useCallback(async () => {
    release();
    const token = generation.current;
    setPhase("asking"); setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera preview needs HTTPS and a supported browser.");
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 800 } }, audio: false });
      if (token !== generation.current || document.hidden || !video.current) {
        media.getTracks().forEach(track => track.stop());
        return;
      }
      stream.current = media;
      video.current.srcObject = media;
      await video.current.play();
      if (token !== generation.current) return;
      setPhase("on");
      media.getVideoTracks().forEach(track => {
        track.onended = () => { if (token === generation.current) stop(); };
      });
    } catch (e) {
      if (token !== generation.current) return;
      stop();
      setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Camera blocked. Check your browser’s camera permissions." : "Couldn’t open the camera. You can still sign in to get roasted.");
    }
  }, [release, stop]);

  useEffect(() => {
    let mounted = true;
    // Defer until hydration settles; Strict Mode cleanup cancels the first setup.
    queueMicrotask(() => { if (mounted && !document.hidden) void openMirror(); });
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", stop);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", stop);
      release();
    };
  }, [openMirror, release, stop]);

  return <main id="main" className={styles.landing} data-guest-landing>
    <div className={styles.topline}>
      <Link href="/" className={styles.wordmark} aria-label="checked home">
        <svg viewBox="0 0 1440 420" fill="none" aria-hidden="true" focusable="false">
          <text x="12" y="365" textLength="1413" lengthAdjust="spacingAndGlyphs" className={styles.brandAccent}>checked</text>
        </svg>
      </Link>
    </div>
    <section className={styles.hero}>
      <div className={styles.copy}>
        <h1>Mirror, mirror.<br />On the wall.<br /><em>Big ego.<br />Watch it fall.</em></h1>
        <div className={styles.actions}><Link href="/login" className={styles.primary}>Check my ego <span aria-hidden="true">↗</span></Link><Link href="/challenges" className={styles.secondary}>Watch a battle <span aria-hidden="true">→</span></Link></div>
      </div>
      <section className={styles.mirrorPanel} aria-label="Try the local mirror">
        <div className={styles.mirrorScene}>
          <span className={styles.orbit} aria-hidden="true" />
          <div className={styles.sticker} aria-hidden="true">100%<br /><strong>YOU</strong><small>UNFORTUNATELY.</small></div>
          <div className={styles.frame}>
            <div className={styles.glass}>
              <video ref={video} autoPlay muted playsInline className={styles.preview} data-active={phase === "on"} aria-label="Local mirrored camera preview" />
              {phase !== "on" && <div className={styles.reflection} aria-hidden="true"><svg viewBox="0 0 240 270" fill="none"><path d="M50 124C50 47 67 23 120 23s70 24 70 101c0 83-27 120-70 120S50 207 50 124Z" stroke="currentColor" strokeWidth="2" /><path className={styles.eyebrow} d="m73 94 28-7m39 0 28 7" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /><ellipse cx="90" cy="117" rx="6" ry="10" fill="currentColor" /><ellipse cx="151" cy="117" rx="6" ry="10" fill="currentColor" /><path d="M83 165c18 30 57 30 75-8" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /><path d="m121 120-7 28h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg><span>OH. IT’S YOU.</span></div>}
              <div className={styles.glare} aria-hidden="true" />
              <div className={styles.mirrorStatus}><span className={phase === "on" ? styles.onDot : styles.offDot} aria-hidden="true" />{phase === "on" ? "LOCAL MIRROR · NO AI" : phase === "asking" ? "WAITING FOR CAMERA" : "CAMERA OFF"}</div>
            </div>
          </div>
          <span className={styles.scribble} aria-hidden="true">the usual suspect ↗</span>
        </div>
        <div className={styles.mirrorControls}>
          <p className={styles.previewNote}>Local preview only. No uploads or audio.</p>
          <button className={styles.mirrorButton} onClick={() => { if (phase === "off") void openMirror(); else stop(); }}>{phase === "on" ? "Turn off mirror" : phase === "asking" ? "Cancel camera request" : "Try the mirror"}<span aria-hidden="true">{phase === "on" ? "×" : "↗"}</span></button>
          <p className={styles.error} role="status" aria-live="polite">{error}</p>
        </div>
      </section>
    </section>
  </main>;
}
