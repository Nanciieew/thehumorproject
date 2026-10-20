"use client";

import { useEffect, useRef, useState } from "react";
import type { Intensity, RoastEvent, RoastResponse } from "@/lib/roast/contracts";
import Image from "next/image";
import styles from "./studio.module.css";
import { RoastMeme } from "./roast-meme";
import { PublishEgo } from "./publish-ego";
import { readCheckedMeme, type CachedCheckedMeme } from "@/lib/checked-meme-cache";

type Point = { x: number; y: number };
type Tracking = { faces: number; x: number; y: number; at: number };
const demos = ["This is a sample punchline. The camera has not been analyzed by AI.", "Demo comedian reporting for duty. My observational skills are currently fictional.", "Mock mode: all the audacity, none of the cloud analysis."];

export function RoastStudio({ mock, configured, userId }: { mock: boolean; configured: boolean; userId?: string }) {
  const [selected, setSelected] = useState<{ receipt: string; snapshot: string; roast: string; generated?: boolean } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [finished, setFinished] = useState<CachedCheckedMeme | null>(null);
  const [direction, setDirection] = useState("");
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
  const options = useRef({ intensity: "savage" as Intensity, excludedTopics: [] as string[], direction: "" });
  const [consent, setConsent] = useState(false);
  const [camera, setCamera] = useState(false);
  const [starting, setStarting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [message, setMessage] = useState("");
  const [intensity, setIntensity] = useState<Intensity>("savage");
  const [topics, setTopics] = useState("");

  useEffect(() => {
    if (mock || !userId) return;
    let cancelled = false;
    const version = generation.current;
    void readCheckedMeme(userId).then(cached => {
      if (!cancelled && cached && generation.current === version) setSelected(previous => previous ?? { ...cached, generated: true });
    });
    return () => { cancelled = true; };
  }, [mock, userId]);

  function invalidate(reset = false) {
    generation.current++; request.current?.abort(); request.current = null; busy.current = false;
    frames.current = []; events.current = []; setThinking(false);
    if (reset) { setSelected(null); setFinished(null); }
    if (reset && session.current) {
      void fetch("/api/roast/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: session.current }), keepalive: true }).catch(() => {});
      session.current = crypto.randomUUID();
    }
  }
  function pause() { running.current = false; setEnabled(false); invalidate(); }
  function roastAgain() {
    if (running.current || busy.current || !consentRef.current || !workerReady.current || !stream.current) return;
    invalidate(); setSelected(null); setFinished(null); setMessage("");
    running.current = true; setEnabled(true);
  }
  function stop() {
    running.current = false; setEnabled(false); invalidate();
    stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    worker.current?.terminate(); worker.current = null; workerReady.current = false; busyTracking.current = false;
    tracking.current = { faces: 0, x: .5, y: .5, at: 0 };
    setCamera(false); setStarting(false); setReady(false); setFaceCount(0);
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
        if (data.type === "error") { workerReady.current = false; busyTracking.current = false; setReady(false); pause(); setMessage("Local tracking could not load. Refresh the page to restart."); return; }
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
      w.onerror = () => { if (worker.current === w) { workerReady.current = false; busyTracking.current = false; setReady(false); pause(); setMessage("Local face tracking failed. Refresh the page to restart."); } };
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
              if (result.status === "ok" && typeof result.roast === "string") {
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
    setIntensity(nextIntensity); setTopics(nextTopics); options.current = { intensity: nextIntensity, direction: direction.trim(), excludedTopics: nextTopics.split(",").map(s => s.trim().slice(0, 80)).filter(Boolean).slice(0, 10) }; invalidate(true);
  }
  const status = !camera ? starting ? "Waiting for camera permission…" : "Camera starts when you are ready." : !ready ? "Tracking unavailable / loading" : faceCount > 1 ? "One participant only, please" : faceCount === 0 ? "Looking for a face" : !enabled ? "Paused — camera is on" : thinking ? "Thinking…" : "Getting your roast ready…";
  const previewLabel = finished ? "Ego checked" : !camera ? starting ? "Connecting…" : "Camera off" : mock ? "Demo · no AI analysis" : "Camera on";
  const tryAgainDisabled = !finished || publishing || !consent || !configured || (camera && (!ready || enabled));
  return <main id="main" className={styles.page}>
    <header className={styles.header}>
      <div><h1>Get checked<span>.</span></h1><p>Your ego called. We declined.</p></div>
      <div className={styles.decorations} aria-hidden="true">
        <Image className={styles.glassBubbles} src="/checkboard/glass-bubbles.png" alt="" width={1829} height={860} sizes="240px" />
        <Image className={styles.mascot} src="/checkboard/mascot.png" alt="" width={1536} height={1024} sizes="170px" />
        <Image className={styles.sparkle} src="/checkboard/sparkle.svg" alt="" width={32} height={50} />
      </div>
    </header>
    <div className={styles.layout}>
      <section className={styles.stage} aria-label="Camera preview">
        <div className={styles.videoWrap} data-camera={camera}>
          <video ref={video} autoPlay muted playsInline aria-label="Mirrored live webcam" />
          {!camera && <div className={styles.empty}><StudioIcon name="camera" /><h2>Your close-up awaits.</h2><p>A little camera time. A little ego check.</p></div>}
          <div ref={badge} className={styles.badge} aria-hidden="true">✳ MAIN CHARACTER</div>
          <span className={styles.live} data-on={camera && !finished}><i aria-hidden="true" />{previewLabel}</span>
          {!mock && selected && <RoastMeme key={selected.receipt} {...selected} onBusyChange={setPublishing} userId={userId} onGenerated={setFinished} />}
        </div>
        <p className={styles.status} role="status"><span aria-hidden="true">●</span> {status}</p>
      </section>
      <section className={styles.controls} aria-label="Experience controls">
        <h2>How spicy?</h2>
        <fieldset className={styles.spice} disabled={publishing}>
          <legend className="visually-hidden">Roast intensity</legend>
          {(["playful", "savage", "profane"] as const).map(value => <label key={value} className={styles.spiceChoice}>
            <input type="radio" name="roast-intensity" value={value} checked={intensity === value} onChange={() => changeSettings(value, topics)} />
            <span>{value === "playful" ? "Playful" : value === "savage" ? "Savage" : "Profane"}</span>
          </label>)}
        </fieldset>
        <div className={styles.keyword}><label htmlFor="roast-direction">Keyword <span>Optional</span></label><input id="roast-direction" maxLength={500} placeholder="Finals week, first dates, office life…" value={direction} disabled={publishing || enabled} onChange={event => { setDirection(event.target.value); options.current.direction = event.target.value.trim(); }} /></div>
        <details className={styles.topics}><summary>Topics to avoid <StudioIcon name="chevron" /></summary><label className="visually-hidden" htmlFor="roast-topics">Topics to avoid</label><input id="roast-topics" value={topics} disabled={publishing} maxLength={800} placeholder="work, dating, my room…" onChange={e => changeSettings(intensity, e.target.value)} /><p className={styles.note}>Up to 10, separated by commas.</p></details>
        <div className={styles.consent}>
          {mock && <p>Mock mode: no camera snapshots are uploaded. Captions are scripted.</p>}
          <label><input type="checkbox" checked={consent} onChange={e => changeConsent(e.target.checked)} /><span>{mock ? "I understand this is a local demo with scripted captions." : "I agree to send snapshots to Gemini for AI roasts and Seedream to add the punchline."}</span></label>
        </div>
        {!configured && <p role="alert" className={styles.message}>Live roasting is unavailable right now. Please try again later.</p>}
        {!camera && !starting && <button className={styles.primary} disabled={!consent || !configured || publishing} onClick={() => void start()}>Check my ego <span aria-hidden="true">→</span></button>}
        {starting && <button className={styles.primary} onClick={stop}>Cancel camera request</button>}
        {camera && <button className={styles.primary} disabled={!consent || !ready || publishing} onClick={() => { if (enabled) pause(); else roastAgain(); }}>{enabled ? "Cancel roast" : "Hurt my feelings again ↗"}</button>}
        {message && <p role="alert" className={styles.message}>{message}</p>}
      </section>
    </div>
    <section className={styles.resultPanel} aria-label="Your punchline">
      <div><h2>Your punchline</h2><p>{finished ? "Your screenshot is ready to share." : selected && publishing ? "Your screenshot is taking shape." : "Your roast will appear in your screenshot."}</p></div>
      <div className={styles.resultActions}>
        <button className={styles.secondary} disabled={tryAgainDisabled} onClick={() => { if (camera) roastAgain(); else void start(); }}><StudioIcon name="refresh" />Try again</button>
        {finished ? <PublishEgo key={finished.receipt} {...finished} onBusyChange={setPublishing} /> : <button className={`${styles.challengeButton} ${styles.publishButton}`} disabled><StudioIcon name="send" />Publish</button>}
      </div>
    </section>
  </main>;
}

function StudioIcon({ name }: { name: "camera" | "refresh" | "send" | "chevron" }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "camera" ? <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z" /><circle cx="12" cy="13.5" r="4" /></> : name === "refresh" ? <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9" /></> : name === "send" ? <><path d="m22 2-7 20-4-9-9-4Z" /><path d="m22 2-11 11" /></> : <path d="m6 9 6 6 6-6" />}
  </svg>;
}
