"use client";

import { useEffect, useRef, useState } from "react";
import type { LeaderboardPeriod, LeaderboardSummary } from "@/lib/leaderboard-types";
import { LeaderboardBoard } from "./board";

type RequestAction = { period: LeaderboardPeriod; cursor?: string };
export function Leaderboard({ initial }: { initial: LeaderboardSummary | null }) {
  const [summary, setSummary] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initial ? null : "Couldn’t load the leaderboard. Please try again.");
  const retry = useRef<RequestAction>({ period: "monthly" });
  const active = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current++; active.current?.abort(); }, []);

  async function load(action: RequestAction) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const requestId = ++sequence.current;
    retry.current = action;
    setPending(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period: action.period });
      if (action.cursor) params.set("cursor", action.cursor);
      const response = await fetch(`/api/leaderboard?${params}`, { cache: "no-store", signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn’t load the leaderboard. Please try again.");
      if (requestId !== sequence.current) return;
      const next = result as LeaderboardSummary;
      setSummary(previous => action.cursor && previous?.period === action.period ? {
        ...next,
        individuals: [...previous.individuals, ...next.individuals.filter(person => !previous.individuals.some(existing => existing.contributor_id === person.contributor_id))],
      } : next);
    } catch (err) {
      if (requestId === sequence.current && !controller.signal.aborted) setError(err instanceof Error ? err.message : "Couldn’t load the leaderboard. Please try again.");
    } finally {
      if (requestId === sequence.current) setPending(false);
    }
  }

  if (!summary) return <main id="main" className="mx-auto max-w-3xl px-6 py-12"><h1>Leaderboard</h1><p role="alert" className="my-6">{error}</p><button type="button" className="action-button" disabled={pending} onClick={() => load(retry.current)}>{pending ? "Loading…" : "Try again"}</button></main>;
  return <LeaderboardBoard summary={summary} pending={pending} error={error}
    onPeriodChange={period => { if (period !== summary.period) void load({ period }); }}
    onLoadMore={() => { if (summary.next_cursor) void load({ period: summary.period, cursor: summary.next_cursor }); }}
    onRefresh={() => load({ period: summary.period })} onRetry={() => load(retry.current)} />;
}
