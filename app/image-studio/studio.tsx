"use client";

import { PlayfulTitle } from "../playful-title";
import Image from "next/image";
import sampleTest from "@/lib/seedream-test.json";
import { useRef, useState } from "react";
import { SEEDREAM_MODEL, SEEDREAM_TEST_PROMPT } from "@/lib/seedream";
import { PublishButton } from "./publish-button";
import { CameraArtwork, EmptyImageArtwork, Icon } from "../ui";

type Generation = { id: string; prompt: string; test: boolean; url?: string; error?: string; generationId?: string; published?: boolean };

export function ImageStudio({ configured, saved }: { configured: boolean; saved: Generation[] }) {
  const [prompt, setPrompt] = useState("");
  const [reference, setReference] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState("");
  const [readingReference, setReadingReference] = useState(false);
  const referenceInput = useRef<HTMLInputElement>(null);
  const referenceReadId = useRef(0);

  function chooseReference(file: File | undefined) {
    const readId = ++referenceReadId.current;
    setReference(null);
    setReadingReference(false);
    setReferenceError("");
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || !file.size || file.size > 2 * 1024 * 1024) {
      setReferenceError("Choose a JPG or PNG reference photo up to 2 MB.");
      return;
    }
    setReadingReference(true);
    const reader = new FileReader();
    reader.onload = () => { if (referenceReadId.current === readId) { setReadingReference(false); if (typeof reader.result === "string") setReference(reader.result); } };
    reader.onerror = () => { if (referenceReadId.current === readId) { setReadingReference(false); setReferenceError("Couldn’t read this photo. Please choose it again."); } };
    reader.readAsDataURL(file);
  }
  const [history, setHistory] = useState<Generation[]>(saved);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [testStatus, setTestStatus] = useState("Not run during this visit");

  async function generate(text: string, test = false) {
    if (inFlight.current || readingReference || !text.trim()) return;
    inFlight.current = true;
    setBusy(true);
    if (test) setTestStatus("Running…");
    const id = crypto.randomUUID();
    setHistory((items) => [{ id, prompt: text.trim(), test }, ...items]);
    try {
      const response = await fetch("/api/images", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, ...(!test && reference ? { image: reference } : {}) }), signal: AbortSignal.timeout(170_000),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "No image returned. Please try again.");
      setHistory((items) => items.map((item) => item.id === id ? { ...item, url: data.url, generationId: data.generationId } : item));
      if (test) setTestStatus("Passed — image generated");
    } catch (error) {
      const message = error instanceof Error && error.name === "TimeoutError" ? "Generation timed out. Please try again." : error instanceof Error ? error.message : "Generation failed. Please try again.";
      setHistory((items) => items.map((item) => item.id === id ? { ...item, error: message } : item));
      if (test) setTestStatus("Failed — see result below");
    } finally { setBusy(false); inFlight.current = false; }
  }

  const latest = history[0];

  function result(item: Generation) {
    return <>
      {item.url && <Image src={item.url} alt={item.prompt} width={2048} height={2048} unoptimized className="generated-image" />}
      <div className="generated-info"><p className="eyebrow">{item.test ? "SAMPLE TEST" : "YOUR PROMPT"}</p><p className="generation-prompt">{item.prompt}</p>
        {item.error ? <p role="alert" className="form-error">{item.error}</p> : !item.url ? <p role="status" className="generation-pending">Seedream is creating your image. This can take a few minutes…</p> : <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-button">Open full image ↗</a>}
        {item.url && item.generationId && <PublishButton generationId={item.generationId} published={item.published} />}
      </div>
    </>;
  }

  return <main id="main">
    <header className="page-hero studio-hero"><div><p className="eyebrow"><span aria-hidden="true">✳</span> IMAGE STUDIO / SEEDREAM</p><PlayfulTitle text="Image Studio" /><p>Big ideas, little prompts. Turn a passing thought<br />into a photo worth sharing.</p></div><CameraArtwork /></header>
    {!configured && <p role="status" className="config-notice">Image generation awaits server setup: ARK_API_KEY is missing.</p>}
    <div className="studio-layout">
      <section className="prompt-panel" aria-labelledby="prompt-title"><p className="eyebrow">01 / THE IDEA</p><h2 id="prompt-title">WHAT’S ON YOUR MIND?</h2><p className="panel-description">Tell us the subject, the setting, and the feeling. English or Chinese—your imagination speaks both.</p>
        <form noValidate onSubmit={(event) => { event.preventDefault(); void generate(prompt); }}>
          <label htmlFor="image-prompt">Your prompt</label><textarea id="image-prompt" required maxLength={4000} rows={6} disabled={busy} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A cat reading the morning paper on the New York subway. Warm light, a little cinematic, a lot of attitude…" />
          <div className="prompt-count"><span>Think wonderfully weird.</span><span>{prompt.length.toLocaleString()} / 4,000</span></div>
          <div className="reference-picker"><label htmlFor="reference-photo"><Icon name="upload" /><span>Add a reference photo<small>Optional · JPG or PNG · Up to 2 MB</small></span><span aria-hidden="true">+</span></label><input ref={referenceInput} id="reference-photo" className="visually-hidden" type="file" accept="image/jpeg,image/png" disabled={busy} onChange={(event) => chooseReference(event.target.files?.[0])} />
            {reference && <div className="reference-preview"><Image src={reference} alt="Selected reference photo" width={80} height={80} unoptimized /><button type="button" disabled={busy} onClick={() => { ++referenceReadId.current; setReference(null); setReferenceError(""); if (referenceInput.current) referenceInput.current.value = ""; }}>Remove photo ×</button></div>}
            {referenceError && <p role="alert" className="form-error">{referenceError}</p>}
          </div>
          <div className="studio-settings"><span>Resolution <strong>2K · High quality</strong></span><span>Watermark on ✓</span></div>
          <button aria-label="Generate photo" disabled={busy || readingReference || !configured || !prompt.trim()} className="action-button wide">{busy ? "Dreaming it up…" : "Bring it to life"}<span><Icon name="spark" /></span></button>
          <p className="small-note">{SEEDREAM_MODEL}. Each message generates a new image. Your reference photo, if selected, is sent to Seedream when you generate.</p>
        </form>
      </section>
      <section className="result-panel" aria-labelledby="latest-result-title"><div className="result-heading"><p id="latest-result-title" className="eyebrow">02 / THE POSSIBILITY</p><span className="result-tag">{busy ? "A LITTLE MAGIC…" : latest?.error ? "TRY AGAIN" : latest?.url ? "IMAGE READY" : "READY WHEN YOU ARE"}</span></div>
        {latest ? result(latest) : <div className="generation-empty"><EmptyImageArtwork /><h3>A LITTLE MAGIC<br />GOES HERE.</h3><p>Start with a thought.<br />We’ll give it a little room to grow.</p></div>}
      </section>
    </div>
    <section className="sample-test" aria-labelledby="test-title"><div><p className="eyebrow">A LITTLE INSPIRATION</p><h2 id="test-title">THE BLACK-HOLE EXPRESS.</h2><p>A vintage train bursts out of a black hole. Cinematic, surreal, and impossible to ignore.</p>
      <details><summary>View sample prompt</summary><p>{SEEDREAM_TEST_PROMPT}</p></details><details><summary>Previous test result ({sampleTest.testedOn})</summary><p>{sampleTest.message} This is a saved result, not a live account status. Run the sample test to check again.</p></details><p role="status" className="test-status">{testStatus}</p>
      </div><button type="button" aria-label="Run sample test" disabled={busy || readingReference || !configured} onClick={() => { setPrompt(SEEDREAM_TEST_PROMPT); void generate(SEEDREAM_TEST_PROMPT, true); }} className="action-button">Try this prompt <span><Icon name="arrow" /></span></button>
    </section>
    <section className="saved-results" aria-labelledby="results-title"><div className="section-heading"><h2 id="results-title">YOUR POSSIBILITIES.</h2></div><p className="small-note">Your latest 30 saved images stay private until you publish them. Refresh this page if a preview link expires.</p>
      {!history.length && <p className="small-note">Run the sample test or send your own prompt to see a result.</p>}
      <div className="saved-grid">{history.slice(1).map((item) => <article key={item.id} className="saved-image-card">{result(item)}</article>)}</div>
    </section>
  </main>;
}
