"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./guest-landing.module.css";

export function GuestLanding() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const [allowed, setAllowed] = useState(false);
  const [phase, setPhase] = useState<"off" | "asking" | "on">("off");
  const [error, setError] = useState("");

  const release = useCallback(() => {
    generation.current++;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  useEffect(() => {
    const hide = () => {
      if (document.hidden) { release(); setPhase("off"); }
    };
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("visibilitychange", hide); release(); };
  }, [release]);

  function stop() { release(); setPhase("off"); }

  async function openMirror() {
    if (!allowed || phase !== "off") return;
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
  }

  return <main id="main" className={styles.landing} data-guest-landing>
    <div className={styles.topline}><Link href="/" className={styles.wordmark} aria-label="Ego Check home">EGO<span>CHECK</span><i aria-hidden="true">✳</i></Link><span className={styles.edition}>SELF-AWARENESS SOLD SEPARATELY.</span></div>
    <section className={styles.hero}>
      <div className={styles.copy}>
        <span className={styles.kicker}><span aria-hidden="true">✳</span> A REALITY CHECK. WITH TEETH.</span>
        <h1>Mirror, mirror.<br />On the wall.<br /><em>You’re the<br />problem.</em></h1>
        <p className={styles.description}>Get roasted. Drag a friend in.<br />Let the crowd finish the job.</p>
        <div className={styles.actions}><Link href="/login" className={styles.primary}>Check my ego <span aria-hidden="true">↗</span></Link><Link href="/challenges" className={styles.secondary}>Watch a battle <span aria-hidden="true">→</span></Link></div>
        <p className={styles.footnote}>Big ego. Small chance of leaving unscathed.</p>
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
          <label className={styles.permission}><input type="checkbox" checked={allowed} onChange={e => { setAllowed(e.target.checked); if (!e.target.checked) stop(); }} />Local camera preview. No uploads.</label>
          <button className={styles.mirrorButton} disabled={!allowed && phase === "off"} onClick={() => { if (phase === "off") void openMirror(); else stop(); }}>{phase === "on" ? "Turn off mirror" : phase === "asking" ? "Cancel camera request" : "Try the mirror"}<span aria-hidden="true">{phase === "on" ? "×" : "↗"}</span></button>
          <p className={styles.previewNote}>Preview only. Sign in for AI roasts.</p>
          <p className={styles.error} role="status" aria-live="polite">{error}</p>
        </div>
      </section>
    </section>
    <div className={styles.bottomline}><span><b>01</b> GET CHECKED</span><span aria-hidden="true">✳</span><span><b>02</b> CHALLENGE A FRIEND</span><span aria-hidden="true">✳</span><span><b>03</b> FACE THE VERDICT</span></div>
  </main>;
}
