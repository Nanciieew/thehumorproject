"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-md px-6 py-20"><h1 className="text-2xl font-bold">Something went wrong</h1><p className="mt-3 opacity-70">We couldn’t load this page. Please try again.</p><button onClick={reset} className="mt-6 rounded-xl border border-current/25 px-5 py-3">Try again</button></main>;
}
