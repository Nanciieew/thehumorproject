"use client";

import { useEffect, useRef, useState } from "react";
import type { Intensity, RoastEvent, RoastResponse } from "@/lib/roast/contracts";
import Link from "next/link";
import { PlayfulTitle } from "../playful-title";
import styles from "./studio.module.css";
import { PublishEgo } from "./publish-ego";
import { setDisguiseDraft } from "@/lib/disguise-draft";

type Point = { x: number; y: number };
type Tracking = { faces: number; x: number; y: number; at: number };
const demos = ["This is a sample punchline. The camera has not been analyzed by AI.", "Demo comedian reporting for duty. My observational skills are currently fictional.", "Mock mode: all the audacity, none of the cloud analysis."];

export function RoastStudio({ mock, configured }: { mock: boolean; configured: boolean }) {
  const [selected, setSelected] = useState<{ receipt: string; snapshot: string; roast: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const badge = useRef<HTMLDivElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const worker = useRef<Worker | null>(null);
  const workerReady = useRef(false);
  const tracking = useRef<Tracking>({ faces: 0, x: .5, y: .5, at: 0 });
  const frames = useRef<{ mimeType: "image/jpeg"; base64: string; capturedAtMs: number }[]>([]);
  const events = useRef<RoastEvent[]>([]);
  const session = useRef("");
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const running = useRef(false);
  const consentRef = useRef(false);
  const options = useRef({ intensity: "savage" as Intensity, excludedTopics: [] as string[] });
  const [consent, setConsent] = useState(false);
  const [camera, setCamera] = useState(false);
  const [starting, setStarting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [caption, setCaption] = useState("");
  const [message, setMessage] = useState("");
  const [intensity, setIntensity] = useState<Intensity>("savage");
  const [topics, setTopics] = useState("");
  const [anchor, setAnchor] = useState<"face" | "screen">("screen");

  function invalidate(reset = false) {
    generation.current++; request.current?.abort(); request.current = null; busy.current = false;
    frames.current = []; events.current = []; setThinking(false);
    if (reset) { setSelected(null); }
    if (reset && session.current) {
      void fetch("/api/roast/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: session.current }), keepalive: true }).catch(() => {});
      session.current = crypto.randomUUID();
    }
  }
  function pause() { running.current = false; setEnabled(false); invalidate(); }
  function roastAgain() {
    if (running.current || busy.current || !consentRef.current || !workerReady.current || !stream.current) return;
    invalidate(); setSelected(null); setCaption(""); setMessage("");
    running.current = true; setEnabled(true);
  }
  function stop() {
    running.current = false; setEnabled(false); invalidate(true);
    stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    worker.current?.terminate(); worker.current = null; workerReady.current = false; busyTracking.current = false;
    tracking.current = { faces: 0, x: .5, y: .5, at: 0 };
    setCamera(false); setStarting(false); setReady(false); setFaceCount(0); setCaption("");
    if (badge.current) badge.current.style.opacity = "0";
  }

  async function start() {
    if (!consentRef.current || !configured) return;
    stop(); const token = generation.current; setStarting(true); setMessage("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access requires HTTPS or localhost and a supported browser.");
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (token !== generation.current || !consentRef.current || document.hidden) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      if (!video.current) { media.getTracks().forEach(t => t.stop()); return; }
      video.current.srcObject = media; await video.current.play();
      video.current.style.aspectRatio = `${video.current.videoWidth} / ${video.current.videoHeight}`;
      if (token !== generation.current) return;
      setCamera(true); setStarting(false); running.current = true; setEnabled(true);
      session.current = crypto.randomUUID();
      initializeTracking();
    } catch (e) {
      if (token !== generation.current) return;
      stop(); setMessage(e instanceof DOMException && e.name === "NotAllowedError" ? "Camera permission was blocked. Allow camera access in your browser and system privacy settings, then try again." : e instanceof Error ? e.message : "Could not open the camera. Check that a camera is connected and available.");
    }
  }

  function initializeTracking() {
    worker.current?.terminate(); workerReady.current = false; busyTracking.current = false; setReady(false); setMessage("Loading local face tracking…");
    try {
      const w = new Worker("/mediapipe/tracker.js"); worker.current = w;
      let previous: { tilt: number; width: number; mouth: number; smile: number; at: number } | null = null;
      let lastEvent = 0;
      w.onmessage = ({ data }) => {
        if (worker.current !== w) return;
        if (data.type === "ready") { workerReady.current = true; setReady(true); setMessage(""); return; }
        if (data.type === "error") { workerReady.current = false; busyTracking.current = false; setReady(false); pause(); setMessage("Local tracking could not load. Retry tracking or restart the experience."); return; }
        busyTracking.current = false;
        const points = data.landmarks as Point[][];
        const count = points.length; const now = Date.now();
        const old = tracking.current;
        if (count !== old.faces) { setFaceCount(count); if (count !== 1) { if (request.current) pause(); else invalidate(); } }
        if (count === 1) {
          const p = points[0]; const nose = p[1];
          tracking.current = { faces: 1, x: old.faces === 1 ? old.x * .65 + nose.x * .35 : nose.x, y: old.faces === 1 ? old.y * .65 + nose.y * .35 : nose.y, at: now };
          const scores = data.blendshapes?.[0]?.categories ?? [];
          const score = (name: string) => scores.find((s: { categoryName: string; score: number }) => s.categoryName === name)?.score ?? 0;
          const current = { tilt: Math.atan2(p[263].y - p[33].y, p[263].x - p[33].x), width: Math.abs(p[454].x - p[234].x), mouth: score("jawOpen"), smile: score("mouthSmileLeft"), at: now };
          if (now - lastEvent > 2000) {
            let type: RoastEvent["type"] | undefined;
            if (old.faces === 0) type = "reentered_frame";
            else if (previous && now - previous.at < 2500) {
              if (Math.abs(current.tilt - previous.tilt) > .18) type = "head_tilt";
              else if (current.width > previous.width * 1.15) type = "lean_in";
              else if (current.mouth - previous.mouth > .25) type = "mouth_open";
              else if (Math.abs(current.smile - previous.smile) > .3) type = "smile_change";
            }
            if (type) { events.current = [...events.current, { type, observedAtMs: now }].slice(-8); lastEvent = now; }
          }
          if (!previous || now - previous.at > 700) previous = current;
        } else { tracking.current = { ...old, faces: count, at: now }; previous = null; frames.current = []; }
      };
      w.onerror = () => { if (worker.current === w) { workerReady.current = false; busyTracking.current = false; setReady(false); pause(); setMessage("Local face tracking failed. Retry tracking."); } };
      w.postMessage({ type: "init" });
    } catch { setMessage("This browser cannot start the tracking worker. Try a current desktop browser."); pause(); }
  }
  const busyTracking = useRef(false);

  useEffect(() => {
    let raf = 0; let last = 0; let lastVideo = -1; let lastCapture = 0; let lastRoast = 0; let demoIndex = 0;
    const tick = (time: number) => {
      const v = video.current; const track = tracking.current; const now = Date.now();
      if (v && stream.current && v.readyState >= 2) {
        if (worker.current && workerReady.current && !busyTracking.current && time - last > 66 && v.currentTime !== lastVideo) {
          last = time; lastVideo = v.currentTime; busyTracking.current = true;
          const w = worker.current;
          void createImageBitmap(v, { resizeWidth: 640, resizeHeight: Math.round(640 * v.videoHeight / v.videoWidth) }).then(bitmap => {
            if (worker.current !== w) { bitmap.close(); return; }
            w.postMessage({ bitmap, time }, [bitmap]);
          }).catch(() => { busyTracking.current = false; });
        }
        const single = track.faces === 1 && now - track.at < 1000;
        if (badge.current) {
          badge.current.style.opacity = single ? "1" : "0";
          badge.current.style.left = `${(1 - track.x) * 100}%`;
          badge.current.style.top = `${Math.max(.08, track.y - .23) * 100}%`;
        }
        if (!single && request.current) pause();
        if (single && running.current && consentRef.current) {
          if (!mock && now - lastCapture > 800) {
            lastCapture = now;
            const c = document.createElement("canvas"); const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
            c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
            c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
            const base64 = c.toDataURL("image/jpeg", .65).split(",")[1];
            if (base64 && base64.length < 273068) frames.current = [...frames.current.filter(f => now - f.capturedAtMs < 3000), { mimeType: "image/jpeg" as const, base64, capturedAtMs: now }].slice(-3);
          }
          if (!busy.current && now - lastRoast >= 8000 && (mock || frames.current.length)) {
            lastRoast = now; busy.current = true; setThinking(true);
            const token = generation.current; const id = crypto.randomUUID(); const sid = session.current;
            const controller = new AbortController(); request.current = controller;
            const body = { sessionId: sid, requestId: id, settings: options.current, frames: frames.current, events: events.current.filter(e => now - e.observedAtMs < 3000) };
            const work: Promise<RoastResponse> = mock
              ? new Promise(resolve => { const timer = setTimeout(() => resolve({ sessionId: sid, requestId: id, status: "ok", roast: demos[demoIndex++ % demos.length], anchor: "screen" }), 900); controller.signal.addEventListener("abort", () => { clearTimeout(timer); resolve({ sessionId: sid, requestId: id, status: "skip", roast: null, anchor: "screen" }); }, { once: true }); })
              : fetch("/api/roast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(16000)]) }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.message ?? "AI roasting is unavailable."); return data; });
            void work.then(result => {
              if (token !== generation.current || controller.signal.aborted || !running.current || !consentRef.current || tracking.current.faces !== 1 || Date.now() - tracking.current.at > 1000 || Date.now() - now > 14000 || result.sessionId !== sid || result.requestId !== id) return;
              if (result.status === "ok" && typeof result.roast === "string") { setCaption(result.roast); setAnchor(result.anchor);
                if (!mock && result.receipt && body.frames.length) {
                  setSelected({ receipt: result.receipt, snapshot: body.frames[body.frames.length - 1].base64, roast: result.roast });
                } }
              else { setMessage("No roast came back. Try again when you’re ready."); }
            }).catch(e => { if (token === generation.current && !controller.signal.aborted) { pause(); setMessage(e instanceof Error ? e.message : "AI roasting failed. Try again when you’re ready."); } }).finally(() => {
              // Each click authorizes one attempt, including a skip or stale response.
              if (token === generation.current) pause();
            });
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const hidden = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hidden);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", hidden); stop(); };
    // All asynchronous state is read through refs so a settings render never restarts the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mock]);

  function changeConsent(value: boolean) { consentRef.current = value; setConsent(value); if (!value) { if (starting) stop(); else pause(); } }
  function changeSettings(nextIntensity: Intensity, nextTopics: string) {
    pause();
    setIntensity(nextIntensity); setTopics(nextTopics); options.current = { intensity: nextIntensity, excludedTopics: nextTopics.split(",").map(s => s.trim().slice(0, 80)).filter(Boolean).slice(0, 10) }; invalidate(true); setCaption("");
  }
  const status = !camera ? starting ? "Waiting for camera permission…" : "Camera off" : !ready ? "Tracking unavailable / loading" : faceCount > 1 ? "One participant only, please" : faceCount === 0 ? "Looking for a face" : !enabled ? "Paused — camera is on" : thinking ? "Thinking…" : "Getting your roast ready…";
  return <main id="main" className={styles.page}>
    <header className="page-hero"><div><PlayfulTitle text="Get checked." /><p>Your ego called. We declined.</p></div></header>
    <div className={styles.layout}>
      <section className={styles.stage} aria-label="Camera preview">
        <div className={styles.videoWrap} data-camera={camera}>
          <video ref={video} autoPlay muted playsInline aria-label="Mirrored live webcam" />
          {!camera && <div className={styles.empty}><span aria-hidden="true">✳</span><h2>Your close-up awaits.</h2></div>}
          <div ref={badge} className={styles.badge} aria-hidden="true">✳ MAIN CHARACTER</div>
          <span className={styles.live}>{mock ? "DEMO · NO AI ANALYSIS" : "GEMINI AI"}</span>
          {!mock && selected && !enabled && !thinking && <div className={styles.resultActions}>
            <PublishEgo key={selected.receipt} {...selected} onBusyChange={setPublishing} />
            <Link href="/disguise" className={`${styles.challengeButton} ${styles.disguiseButton}`} aria-disabled={publishing} onClick={e => { if (publishing) { e.preventDefault(); return; } pause(); setDisguiseDraft(selected.snapshot); }}>Checked Factory ↗</Link>
          </div>}
        </div>
        <div className={caption ? styles.caption : "visually-hidden"} data-anchor={anchor}><p className="eyebrow">{mock ? "DEMO · SCRIPTED CAPTION" : "THE PUNCHLINE"}</p><p role="status" aria-live="polite">{caption}</p></div>
        <p className={styles.status} role="status">● {status}</p>
      </section>
      <section className={styles.controls} aria-label="Experience controls">
        <h2>How spicy?</h2>
        <label htmlFor="roast-intensity">Roast intensity</label><select id="roast-intensity" value={intensity} disabled={publishing} onChange={e => changeSettings(e.target.value as Intensity, topics)}><option value="playful">Playful</option><option value="savage">Savage</option><option value="profane">Profane · swearing</option></select>
        <details className="ego-details"><summary>Topics to avoid</summary><label className="visually-hidden" htmlFor="roast-topics">Topics to avoid</label><input id="roast-topics" value={topics} disabled={publishing} maxLength={800} placeholder="work, dating, my room…" onChange={e => changeSettings(intensity, e.target.value)} /><p className={styles.note}>Up to 10, separated by commas.</p></details>
        <div className={styles.consent}>
          {mock && <p>Mock mode: no camera snapshots are uploaded. Captions are scripted.</p>}
          <label><input type="checkbox" checked={consent} onChange={e => changeConsent(e.target.checked)} />{mock ? "I understand this is a local demo with scripted captions." : "I agree to send snapshots to Gemini for AI roasts."}</label>

        </div>
        {!configured && <p role="alert">Live roasting is not configured. Set the Gemini credentials and model on the server.</p>}
        {!camera && !starting && <button className="action-button wide" disabled={!consent || !configured} onClick={() => void start()}>Check my ego ↗</button>}
        {starting && <button className="action-button wide" onClick={stop}>Cancel camera request</button>}
        {camera && <><button className="action-button wide" disabled={!consent || !ready || publishing} onClick={() => { if (enabled) pause(); else roastAgain(); }}>{enabled ? "Cancel roast" : "Hurt my feelings again ↗"}</button><p className={styles.note}>One roast per click.</p><div className={styles.buttons}><button disabled={publishing} onClick={() => { pause(); invalidate(true); setCaption(""); }}>Clear Session</button><button onClick={stop}>Stop Camera</button></div>{!ready && <button onClick={() => { busyTracking.current = false; initializeTracking(); }}>Retry tracking</button>}</>}
        {message && <p role="alert" className={styles.message}>{message}</p>}
        <details className="ego-details"><summary>Privacy & camera</summary><p className={styles.note}>Camera permission is separate. No microphone is used. Tracking runs locally; hiding or leaving this page stops the camera.</p>{!mock && <p className={styles.note}>Selected snapshots go to Gemini. Unchecking consent stops new uploads; images already sent cannot be recalled. This app doesn’t save session images unless you approve sharing. <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">Gemini data terms ↗</a></p>}</details>
      </section>
    </div>
  </main>;
}
