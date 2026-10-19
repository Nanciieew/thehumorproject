"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QUEST_HISTORY_EVENT, questDay, questSummary, readQuestHistory, type QuestHistory } from "@/lib/checkly-quest";
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
  return <main id="main" data-quest-screen="dashboard" className={styles.dashboard}>
    <header className={styles.hero}>
      <h1>Checkly Quest<span>.</span></h1>
      <Link href="/quest" className={styles.primary}>{ready && summary.completedToday ? "Keep voting" : "Start daily quest"}<span aria-hidden="true">→</span></Link>
    </header>
    <section aria-labelledby="stats-title" className={styles.statsSection}>
      <h2 id="stats-title" className="visually-hidden">Your voting activity</h2>
      <div className={styles.stats}>
        <article className={styles.streak}><p>Current streak</p><strong>{ready ? summary.streak : "—"}<span> {summary.streak === 1 ? "day" : "days"}</span></strong></article>
        <article><p>Upvotes given <span aria-hidden="true" className={styles.up}>↑</span></p><strong>{ready ? summary.upvotes : "—"}</strong></article>
        <article><p>Downvotes given <span aria-hidden="true">↓</span></p><strong>{ready ? summary.downvotes : "—"}</strong></article>
      </div>
    </section>
    <section className={styles.week} aria-labelledby="week-title">
      <div className={styles.sectionHead}><h2 id="week-title">This week</h2><p><strong>{ready ? summary.completedThisWeek : "—"}</strong> / 7 completed</p></div>
      <ol className={styles.timeline} aria-label="Weekly quest completion">{summary.week.map((day, index) => <li key={day.day} data-completed={ready && day.completed} data-today={ready && day.today} data-future={ready && day.future}>
        <span className={styles.day}>{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][index]}</span>
        <span className={styles.check} aria-label={`${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][index]}: ${ready && day.completed ? "completed" : "not completed"}`}>{ready && day.completed ? "✓" : <span aria-hidden="true">{Number(day.day.slice(-2))}</span>}</span>
        <span className={styles.dayStatus}>{ready && day.today ? "Today" : ready && day.completed ? "Done" : ""}</span>
      </li>)}</ol>
      <p className={styles.weekNote}>{ready && summary.completedToday ? "Today’s quest is complete." : "Rate up to 10 memes to complete today’s quest."}</p>
    </section>
    <p className={styles.storageNote}>Saved in this browser · Resets at midnight, New York time</p>
  </main>;
}
