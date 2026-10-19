"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QUEST_HISTORY_EVENT, questDay, questSummary, readQuestHistory, shiftDay, type QuestHistory } from "@/lib/checkly-quest";
import styles from "./checkly-dashboard.module.css";

export function ChecklyDashboard({ userId }: { userId: string; firstName: string }) {
  const [history, setHistory] = useState<QuestHistory>({});
  const [today, setToday] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const refresh = () => { setHistory(readQuestHistory(userId)); setToday(questDay()); setReady(true); };
    refresh();
    window.addEventListener(QUEST_HISTORY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60_000);
    const url = new URL(window.location.href);
    if (url.searchParams.get("welcome") === "quest") {
      url.searchParams.delete("welcome");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    return () => { window.removeEventListener(QUEST_HISTORY_EVENT, refresh); window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [userId]);
  const summary = questSummary(history, today ?? "2000-01-03");
  const activity = Array.from({ length: 30 }, (_, index) => {
    const date = shiftDay(today ?? "2000-01-03", index - 29);
    const entry = ready ? history[date] : undefined;
    const votes = Object.keys(entry?.votes ?? {}).length;
    const levels = [
      Math.ceil(Math.min(votes, 3) / 3 * 3),
      Math.ceil(Math.min(Math.max(votes - 3, 0), 3) / 3 * 3),
      Math.ceil(Math.min(Math.max(votes - 6, 0), 4) / 4 * 3),
    ];
    const label = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).format(new Date(`${date}T12:00:00Z`));
    return { date, levels, label: `${label}: ${votes} ${votes === 1 ? "vote" : "votes"}${entry?.completed ? ", quest complete" : ""}` };
  });
  const dateLabel = today ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" }).format(new Date(`${today}T12:00:00Z`)) : "";
  return <main id="main" data-quest-screen="dashboard" className={styles.dashboard}>
    <header className={styles.hero}>
      <h1>Checkly Quest</h1><time dateTime={today ?? undefined}>{dateLabel}</time>
    </header>
    <section className={styles.week} aria-labelledby="week-title">
      <div className={styles.weekHeading}><h2 id="week-title">This week</h2><p><strong>{ready ? summary.completedThisWeek : "—"}</strong> of 7 completed</p></div>
      <Link href="/quest" className={styles.primary}>{ready && summary.completedToday ? "Keep voting" : "Start my daily quest"}<span aria-hidden="true">→</span></Link>
      <ol className={styles.timeline} aria-label="Weekly quest completion">{summary.week.map((day, index) => <li key={day.day} data-completed={ready && day.completed} data-today={ready && day.today} data-future={ready && day.future}>
        <span className={styles.day}>{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][index]}</span>
        <span className={styles.check} aria-label={`${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][index]}: ${ready && day.completed ? "completed" : "not completed"}`}>{ready && day.completed ? "✓" : <span aria-hidden="true">{Number(day.day.slice(-2))}</span>}</span>
        <span className={styles.dayStatus}>{ready && day.today ? "Today" : ""}</span>
      </li>)}</ol>
      <p className={styles.weekNote}>{ready && summary.completedToday ? "Today’s quest is complete." : "Rate up to 10 memes to complete your daily quest."}</p>
    </section>
    <section aria-labelledby="stats-title" className={styles.statsSection}>
      <h2 id="stats-title" className="visually-hidden">Your voting activity</h2>
      <div className={styles.stats}>
        <article className={styles.streak}><p>Current streak</p><div className={styles.statValue}><strong>{ready ? summary.streak : "—"}</strong><span>{summary.streak === 1 ? "day" : "days"}</span></div></article>
        <article><p>Upvotes given</p><div className={styles.statValue}><strong>{ready ? summary.upvotes : "—"}</strong><span aria-hidden="true" className={styles.up}>↑</span></div></article>
        <article><p>Downvotes given</p><div className={styles.statValue}><strong>{ready ? summary.downvotes : "—"}</strong><span aria-hidden="true" className={styles.down}>↓</span></div></article>
      </div>
    </section>
    <section className={styles.activity} aria-labelledby="activity-title">
      <div className={styles.activityHeading}><h2 id="activity-title">Your activity</h2><span>Last 30 days</span></div>
      <div className={styles.activityGrid}>
        <div className={styles.rowLabels} aria-hidden="true"><span>1–3</span><span>4–6</span><span>7+</span><span className={styles.mobileRow}>1–3</span><span className={styles.mobileRow}>4–6</span><span className={styles.mobileRow}>7+</span></div>
        <ol className={styles.heatmap} aria-label="Last 30 days of voting activity">{activity.map(day => <li key={day.date} aria-label={day.label} title={day.label}>{day.levels.map((level, row) => <span key={row} data-level={level} aria-hidden="true" />)}</li>)}</ol>
      </div>
      <div className={styles.legend} aria-label="Daily voting levels: rows show votes 1 to 3, 4 to 6, and 7 or more; brighter cells mean more votes in that level"><span>Less</span>{[0, 1, 2, 3].map(level => <i key={level} data-level={level} aria-hidden="true" />)}<span>More</span></div>
    </section>
    <p className="visually-hidden">Saved in this browser · Resets at midnight, New York time</p>
  </main>;
}
