"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main" className="ego-page"><section className="ego-panel"><h1 className="text-3xl">Something went wrong</h1><p className="ego-note">We couldn’t load this page. Please try again.</p><button onClick={reset} className="ego-button">Try again</button></section></main>;
}
