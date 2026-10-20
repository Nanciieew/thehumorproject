"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { QUEST_HISTORY_EVENT, questActivitySlots, questDay, questSummary, readQuestHistory, type QuestHistory } from "@/lib/checkly-quest";
import board from "./my-works/checkboard.module.css";
import type { ReceivedVotes } from "@/lib/checkboard";


export function ChecklyDashboard({ userId, received, children }: { userId: string; firstName?: string; received?: ReceivedVotes | null; children?: ReactNode }) {
  const [history, setHistory] = useState<QuestHistory>({});
  const [today, setToday] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const refresh = () => {
      setHistory(readQuestHistory(userId)); setToday(questDay()); setReady(true);
    };
    refresh();
    window.addEventListener(QUEST_HISTORY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60_000);
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
  const monthTitle = today ? new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "America/New_York" }).format(new Date(`${today}T12:00:00Z`)) : "This month’s";
  return <main id="main" data-quest-screen="dashboard" className={board.checkboard}>
    <section className={board.hero} aria-labelledby="checkboard-title">
      <div className={board.heroAtmosphere} aria-hidden="true" />
      <Image className={board.heroBubbles} src="/checkboard/glass-bubbles.png" alt="" width={1829} height={860} sizes="57vw" aria-hidden="true" />
      <Image className={board.mascot} src="/checkboard/mascot.png" alt="" width={1536} height={1024} sizes="(max-width: 750px) 40vw, 42vw" unoptimized priority aria-hidden="true" />
      <Image className={`${board.spark} ${board.sparkOne}`} src="/checkboard/sparkle.svg" alt="" width={32} height={50} aria-hidden="true" /><Image className={`${board.spark} ${board.sparkTwo}`} src="/checkboard/sparkle.svg" alt="" width={45} height={70} aria-hidden="true" />
      <div className={board.heroContent}>
        <h1 id="checkboard-title">My <span>Checkboard</span></h1>
        <p>Keep the good vibes going. Complete your daily quest and grow your meme streak!</p>
        <h2 className="visually-hidden">Weekly quest</h2>
        <ol className={board.timeline} aria-label="Weekly quest completion">{summary.week.map((day, index) => <li key={day.day} data-completed={ready && day.completed} data-today={ready && day.today} data-future={ready && day.future}>
          <span className={board.day}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</span>
          <span className={board.check} aria-label={`${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][index]}: ${ready && day.completed ? "completed" : "not completed"}`}>{ready && day.completed ? "✓" : <span aria-hidden="true">{Number(day.day.slice(-2))}</span>}</span>
          {ready && day.today && <span className="visually-hidden">Today</span>}
        </li>)}</ol>
        <Link href="/quest" className={board.primary}>{ready && summary.completedToday ? "Keep voting" : "Start daily quest"}<span aria-hidden="true">→</span></Link>
      </div>
    </section>
    <div className={board.overview}>
      <section aria-labelledby="stats-title" className={board.statsSection}>
        <h2 id="stats-title" className="visually-hidden">Your overview</h2>
        <div className={board.stats}>
          <article className={board.streak}><p>Current streak</p><div className={board.statValue}><strong>{ready ? summary.streak : "—"}</strong><span>{summary.streak === 1 ? "day" : "days"}</span></div><span className={board.statIcon} aria-hidden="true"><Image src="/checkboard/streak.svg" alt="" width={34} height={34} /></span></article>
          <article><p>Upvotes received</p><div className={board.statValue}><strong>{received ? BigInt(received.upvotes).toLocaleString("en-US") : "—"}</strong></div><span className={board.statIcon} aria-hidden="true"><Image src="/checkboard/thumb-up.svg" alt="" width={34} height={34} /></span></article>
          <article><p>Downvotes received</p><div className={board.statValue}><strong>{received ? BigInt(received.downvotes).toLocaleString("en-US") : "—"}</strong></div><span className={`${board.statIcon} ${board.downIcon}`} aria-hidden="true"><Image src="/checkboard/thumb-down.svg" alt="" width={34} height={34} /></span></article>
        </div>
      </section>
      <section className={board.activity} aria-labelledby="activity-title">
        <div className={board.activityHeading}><h2 id="activity-title">{monthTitle} activity</h2><div className={board.legend}><span>Less activity</span>{[0, 1, 2, 3].map(level => <i key={level} data-level={level} aria-hidden="true" />)}<span>More activity</span></div></div>
        <div className={board.activityGrid}>
          <div className={board.timeLabels} aria-hidden="true"><span /><span>00–08</span><span>08–16</span><span>16–24</span></div>
          <ol className={board.heatmap} style={{ "--month-days": daysInMonth } as CSSProperties} aria-label="This month’s daily quests">{activity.map(day => <li key={day.date} aria-label={day.label} aria-current={day.date === today ? "date" : undefined}>
            <span className={board.dateNumber} aria-hidden="true">{day.day}</span>
            {day.slots.map((count, slot) => {
              const label = `${monthLabel} ${day.day}, ${["00:00–08:00", "08:00–16:00", "16:00–24:00"][slot]} New York time: ${count} ${count === 1 ? "vote" : "votes"}`;
              return <span key={slot} role="img" aria-label={label} title={label} data-level={count >= 6 ? 3 : count >= 3 ? 2 : count > 0 ? 1 : 0} className={board.activityCell} />;
            })}
          </li>)}</ol>
        </div>
      </section>
    </div>
    {received === null && <p className={board.error} role="alert">Received votes couldn’t load. Refresh the page to try again.</p>}
    {children}
    <Image className={board.cornerCheck} src="/checkboard/glass-checkmark.png" alt="" width={1195} height={1316} sizes="245px" aria-hidden="true" />
    <p className={board.storageNote}>Quest progress saved in this browser · Activity uses New York time</p>
  </main>;
}
