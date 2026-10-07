"use client";

import Image from "next/image";
import sampleTest from "@/lib/seedream-test.json";
import { useRef, useState } from "react";
import { SEEDREAM_MODEL, SEEDREAM_TEST_PROMPT } from "@/lib/seedream";

type Generation = { id: number; prompt: string; test: boolean; url?: string; error?: string };

export function ImageStudio({ configured }: { configured: boolean }) {
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<Generation[]>([{ id: 0, prompt: SEEDREAM_TEST_PROMPT, test: true, error: `${sampleTest.message} (Tested ${sampleTest.testedOn}; ${sampleTest.code})` }]);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [testStatus, setTestStatus] = useState("Failed — account usage limit reached");

  async function generate(text: string, test = false) {
    if (inFlight.current || !text.trim()) return;
    inFlight.current = true;
    setBusy(true);
    if (test) setTestStatus("Running…");
    const id = Date.now();
    setHistory((items) => [{ id, prompt: text.trim(), test }, ...items]);
    try {
      const response = await fetch("/api/images", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }), signal: AbortSignal.timeout(170_000),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "No image returned. Please try again.");
      setHistory((items) => items.map((item) => item.id === id ? { ...item, url: data.url } : item));
      if (test) setTestStatus("Passed — image generated");
    } catch (error) {
      const message = error instanceof Error && error.name === "TimeoutError" ? "Generation timed out. Please try again." : error instanceof Error ? error.message : "Generation failed. Please try again.";
      setHistory((items) => items.map((item) => item.id === id ? { ...item, error: message } : item));
      if (test) setTestStatus("Failed — see result below");
    } finally { setBusy(false); inFlight.current = false; }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="border-b border-current/15 pb-8">
        <p className="text-sm font-semibold uppercase tracking-widest opacity-60">The Humor Project</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Image Studio</h1>
        <p className="mt-3 text-lg opacity-70">Describe a photo in English or Chinese and bring it to life.</p>
        <p className="mt-4 break-all text-xs opacity-60">{SEEDREAM_MODEL} · 2K · Watermark on</p>
      </header>
      {!configured && <p role="status" className="mt-6 rounded-xl border border-current/15 p-4">Image generation awaits server setup: ARK_API_KEY is missing. No test image has been generated yet.</p>}
      <section aria-labelledby="test-title" className="mt-8 rounded-2xl border border-current/15 p-6">
        <h2 id="test-title" className="text-xl font-semibold">Black hole train — sample test</h2>
        <details className="mt-3 text-sm opacity-75"><summary className="cursor-pointer">View original test prompt</summary><p className="mt-3 leading-relaxed">{SEEDREAM_TEST_PROMPT}</p></details>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button type="button" disabled={busy || !configured} onClick={() => generate(SEEDREAM_TEST_PROMPT, true)} className="rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40">Run sample test</button>
          <p role="status" className="text-sm opacity-70">{testStatus}</p>
        </div>
      </section>
      <form onSubmit={(event) => { event.preventDefault(); void generate(prompt); }} className="mt-8 rounded-2xl border border-current/15 p-6">
        <label htmlFor="image-prompt" className="text-xl font-semibold">Talk to Seedream</label>
        <p id="prompt-help" className="mt-2 text-sm opacity-70">Describe the subject, setting, lighting, and style. Each message generates a new image independently.</p>
        <textarea id="image-prompt" aria-describedby="prompt-help" required maxLength={4000} rows={5} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：一只在纽约地铁上读报纸的猫，电影感，温暖的灯光…" className="mt-4 w-full rounded-xl border border-current/20 bg-background p-4 focus-visible:outline-2 focus-visible:outline-offset-2" />
        <div className="mt-3 flex items-center justify-between gap-4"><span className="text-xs opacity-60">{prompt.length}/4,000</span><button disabled={busy || !configured || !prompt.trim()} className="rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Generating…" : "Generate photo"}</button></div>
      </form>
      <section aria-labelledby="results-title" className="mt-10">
        <h2 id="results-title" className="text-2xl font-semibold">Results</h2>
        <p className="mt-2 text-sm opacity-60">Results stay here during this visit. Open and save images before their temporary links expire.</p>
        {!history.length && <p className="mt-6 opacity-60">Run the sample test or send your own prompt to see a result.</p>}
        <div className="mt-6 space-y-6">{history.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-current/15">
          <div className="p-6"><p className="text-xs font-semibold uppercase tracking-widest opacity-60">{item.test ? "Sample test" : "Your prompt"}</p><p className="mt-3 whitespace-pre-wrap leading-relaxed">{item.prompt}</p>
            {item.error ? <p role="alert" className="mt-4">{item.error}</p> : !item.url ? <p role="status" className="mt-4 animate-pulse">Seedream is creating your image. This can take a few minutes…</p> : <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block underline underline-offset-4">Open full image ↗</a>}
          </div>
          {item.url && <Image src={item.url} alt={item.prompt} width={2048} height={2048} unoptimized className="h-auto max-h-[800px] w-full object-contain" />}
        </article>)}</div>
      </section>
    </main>
  );
}
