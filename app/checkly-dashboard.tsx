"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { QUEST_HISTORY_EVENT, questActivitySlots, questDay, questSummary, readQuestHistory, type QuestHistory } from "@/lib/checkly-quest";
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
  const month = (today ?? "2000-01-01").slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthLabel = today ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "America/New_York" }).format(new Date(`${today}T12:00:00Z`)) : "";
  const activity = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const completed = ready && date <= (today ?? "") && history[date]?.completed === true;
    const label = `${monthLabel} ${day}: ${completed ? "quest complete" : "not completed"}`;
    return { date, day, completed, label, slots: questActivitySlots(ready && date <= (today ?? "") ? history[date] : undefined) };
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
      <div className={styles.activityHeading}><h2 id="activity-title">Your activity</h2><span>{monthLabel}</span></div>
      <div className={styles.activityGrid}>
        <div className={styles.timeLabels} aria-hidden="true"><span /><span>00–08</span><span>08–16</span><span>16–24</span></div>
        <ol className={styles.heatmap} style={{ "--month-days": daysInMonth } as CSSProperties} aria-label="This month’s daily quests">{activity.map(day => <li key={day.date} aria-label={day.label} aria-current={day.date === today ? "date" : undefined}>
          <span className={styles.dateNumber} aria-hidden="true">{day.day}</span>
          {day.slots.map((count, slot) => {
            const label = `${monthLabel} ${day.day}, ${["00:00–08:00", "08:00–16:00", "16:00–24:00"][slot]} New York time: ${count} ${count === 1 ? "vote" : "votes"}`;
            return <span key={slot} role="img" aria-label={label} title={label} data-level={count >= 6 ? 3 : count >= 3 ? 2 : count > 0 ? 1 : 0} className={styles.activityCell} />;
          })}
        </li>)}</ol>
      </div>
      <div className={styles.activityFooter}><span>New York time</span><div className={styles.legend}><span>Less</span>{[0, 1, 2, 3].map(level => <i key={level} data-level={level} aria-hidden="true" />)}<span>More</span></div></div>
    </section>
    <p className={styles.storageNote}>Saved in this browser · Resets at midnight, New York time</p>
  </main>;
}
