"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardSummary } from "@/lib/dashboard-types";
import styles from "./dashboard.module.css";

function dollars(cents: string) {
  const amount = BigInt(cents);
  return `$${(amount / BigInt(100)).toLocaleString("en-US")}.${(amount % BigInt(100)).toString().padStart(2, "0")}`;
}
export function DashboardStats({ initial }: { initial: DashboardSummary | null }) {
  const [summary, setSummary] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initial ? "" : "Couldn’t load your dashboard totals. Please try again.");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);
  async function refresh() {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn’t load your dashboard totals. Please try again.");
      if (!controller.signal.aborted) setSummary(data as DashboardSummary);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error && !(err instanceof TypeError) ? err.message : "Couldn’t load your dashboard totals. Please try again.");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const cards = [
    { label: "Revenue earned", value: summary ? dollars(summary.revenue_cents) : "—", note: "USD · after refunds", icon: "$", style: styles.revenue },
    { label: "Upvotes received", value: summary ? BigInt(summary.upvotes).toLocaleString("en-US") : "—", note: "Across your published avatars", icon: "↑", style: styles.votes },
    { label: "Avatars published", value: summary ? BigInt(summary.published_count).toLocaleString("en-US") : "—", note: "Private drafts are excluded", icon: "↗", style: styles.published },
  ];
  return <section className={styles.section} aria-labelledby="overview-title" aria-busy={busy}>
    <div className={styles.heading}><div><h2 id="overview-title">Your overview</h2><p>All-time totals</p></div><button type="button" onClick={() => void refresh()} disabled={busy}>{busy ? "Refreshing…" : error ? "Try again" : "Refresh ↻"}</button></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <dl className={styles.cards}>{cards.map(card => <div key={card.label} className={`${styles.card} ${card.style}`}><span className={styles.icon} aria-hidden="true">{card.icon}</span><dt>{card.label}</dt><dd>{card.value}</dd><p>{card.note}</p></div>)}</dl>
    <span className="visually-hidden" role="status">{busy ? "Refreshing dashboard totals." : summary ? "Dashboard totals loaded." : ""}</span>
  </section>;
}
