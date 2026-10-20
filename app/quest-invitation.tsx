"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { QUEST_HISTORY_EVENT, questDay, readQuestHistory } from "@/lib/checkly-quest";
import styles from "./checkly-dashboard.module.css";

export function QuestInvitation({ userId }: { userId: string }) {
  const invitation = useRef<HTMLDialogElement>(null);
  const pendingLogin = useRef<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const dismissInvitation = () => {
    pendingLogin.current = null;
    invitation.current?.close();
    returnFocus.current?.focus();
  };
  useEffect(() => {
    const element = invitation.current;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const url = new URL(window.location.href);
    if (url.searchParams.get("welcome") === "quest") {
      pendingLogin.current = userId;
      url.searchParams.delete("welcome");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    const refresh = () => {
      const date = questDay();
      if (readQuestHistory(userId)[date]?.completed) {
        pendingLogin.current = null;
        element?.close();
      } else if (pendingLogin.current === userId && element && !element.open) {
        element.showModal();
      }
    };
    refresh();
    window.addEventListener(QUEST_HISTORY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { window.removeEventListener(QUEST_HISTORY_EVENT, refresh); window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); window.clearInterval(timer); element?.close(); };
  }, [userId]);
  return (
<dialog ref={invitation} className={styles.invitation} aria-labelledby="daily-invitation-title" onCancel={event => { event.preventDefault(); dismissInvitation(); }}>
      <div className={styles.invitationEyebrow}><span aria-hidden="true">✦</span> DAILY QUEST</div>
      <div className={styles.invitationArt} aria-hidden="true">
        <div className={styles.memeLeft}><span>THE VERDICT</span><strong>LOL.</strong><i>↑</i></div>
        <div className={styles.memeRight}><span>BE HONEST</span><strong>meh.</strong><i>↓</i></div>
        <svg className={styles.questFace} viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="45" fill="#e8f044" /><g stroke="#191c13" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"><path d="m23 39 8 8 15-17m27 3-10 6 10 5M31 62q19 21 38 0" /></g></svg>
        <span className={styles.artSpark}>✦</span><span className={styles.artSparkSmall}>✧</span>
      </div>
      <h2 id="daily-invitation-title">Your daily dose<br />of <em>bad judgment.</em></h2>
      <p>Up to 10 memes. A few honest votes.<br />One more day checked off.</p>
      <div className={styles.invitationActions}><Link href="/quest" className={styles.primary} onClick={dismissInvitation}>Let’s judge some memes <span aria-hidden="true">→</span></Link><button type="button" onClick={dismissInvitation}>Maybe later</button></div>
    </dialog>
  );
}
