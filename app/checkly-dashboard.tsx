"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { QUEST_HISTORY_EVENT, questDay, questSummary, readQuestHistory, type QuestHistory } from "@/lib/checkly-quest";
import styles from "./checkly-dashboard.module.css";

export function ChecklyDashboard({ userId, firstName }: { userId: string; firstName: string }) {
  const [history, setHistory] = useState<QuestHistory>({});
  const [today, setToday] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const loginInvitation = useRef(false);
  const start = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const refresh = () => { setHistory(readQuestHistory(userId)); setToday(questDay()); setReady(true); };
    refresh();
    window.addEventListener(QUEST_HISTORY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60_000);
    const element = dialog.current;
    const url = new URL(window.location.href);
    const afterLogin = url.searchParams.get("welcome") === "quest";
    loginInvitation.current ||= afterLogin;
    let show = true;
    const promptKey = `checked:quest-prompt:${userId}:${questDay()}`;
    try { show = loginInvitation.current || !sessionStorage.getItem(promptKey); } catch { /* The prompt can still be dismissed. */ }
    if (show) element?.showModal();
    if (afterLogin) { url.searchParams.delete("welcome"); window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`); }
    return () => { window.removeEventListener(QUEST_HISTORY_EVENT, refresh); window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); window.clearInterval(timer); element?.close(); };
  }, [userId]);
  function dismiss() {
    loginInvitation.current = false;
    try { sessionStorage.setItem(`checked:quest-prompt:${userId}:${questDay()}`, "1"); } catch { /* Dismiss for this visit. */ }
    dialog.current?.close(); start.current?.focus();
  }
  const summary = questSummary(history, today ?? "2000-01-03");
  return <main id="main" className={styles.dashboard}>
    <header className={styles.hero}>
      <div><p className={styles.eyebrow}>YOUR DAILY CHECK-IN</p><h1>Checkly Quest<span>.</span></h1><p>{firstName ? `Hey ${firstName}. ` : ""}A little judgment. A good daily habit.</p></div>
      <Link ref={start} href="/quest" className={styles.primary}>{ready && summary.completedToday ? "Keep on going" : "Finish my daily quest"}<span aria-hidden="true">↗</span></Link>
    </header>
    <section className={styles.week} aria-labelledby="week-title">
      <div className={styles.sectionHead}><div><p className={styles.eyebrow}>ONE CHECK AT A TIME</p><h2 id="week-title">Your week, checked.</h2></div><p><strong>{ready ? summary.completedThisWeek : "—"}</strong> / 7 days completed</p></div>
      <ol className={styles.timeline} aria-label="Weekly quest completion">{summary.week.map((day, index) => <li key={day.day} data-completed={ready && day.completed} data-today={ready && day.today} data-future={ready && day.future}>
        <span className={styles.day}>{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][index]}</span>
        <span className={styles.check} aria-label={`${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][index]}: ${ready && day.completed ? "completed" : "not completed"}`}>{ready && day.completed ? "✓" : <span aria-hidden="true">{index + 1}</span>}</span>
        <span className={styles.dayStatus}>{ready && day.today ? "Today" : ready && day.completed ? "Done" : ""}</span>
      </li>)}</ol>
      <p className={styles.weekNote}>{ready && summary.completedToday ? "Today is checked off. Nice work — come back tomorrow to grow your streak." : "Finish today’s quest to earn your check. Up to 10 memes. Every vote counts."}</p>
    </section>
    <section aria-labelledby="stats-title" className={styles.statsSection}><div className={styles.sectionHead}><h2 id="stats-title">Your checkboard</h2><span className={styles.eyebrow}>CHECKLY QUEST ACTIVITY</span></div>
      <div className={styles.stats}>
        <article className={styles.streak}><span className={styles.statIcon} aria-hidden="true">✳</span><p>Current streak</p><strong>{ready ? summary.streak : "—"}<span> {summary.streak === 1 ? "day" : "days"}</span></strong><p>Consecutive daily quests completed</p></article>
        <article><span className={styles.statIcon} aria-hidden="true">↑</span><p>Upvotes given</p><strong>{ready ? summary.upvotes : "—"}</strong><p>Memes that got your approval</p></article>
        <article><span className={`${styles.statIcon} ${styles.down}`} aria-hidden="true">↓</span><p>Downvotes given</p><strong>{ready ? summary.downvotes : "—"}</strong><p>Your honest verdicts</p></article>
      </div>
      <p className={styles.storageNote}>Quest history is saved in this browser. Days reset at midnight New York time.</p>
    </section>
    <dialog ref={dialog} className={styles.welcome} aria-labelledby="quest-welcome-title" onCancel={event => { event.preventDefault(); dismiss(); }}>
      <button className={styles.close} aria-label="Close quest invitation" onClick={dismiss}>×</button>
      <span className={styles.welcomeMark} aria-hidden="true">✓</span><p className={styles.eyebrow}>YOUR DAILY DOSE OF CHECKED</p><h2 id="quest-welcome-title">Ready for your Checkly Quest?</h2><p>Fresh memes are waiting for your verdict. Rate up to 10 to finish today’s quest and grow your streak.</p>
      <Link href="/quest" className={styles.primary} onClick={dismiss}>Join the voting<span aria-hidden="true">→</span></Link><button className={styles.later} onClick={dismiss}>Maybe later</button>
    </dialog>
  </main>;
}
