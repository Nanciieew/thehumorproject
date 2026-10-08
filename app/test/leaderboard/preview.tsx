"use client";

import { useState } from "react";
import Link from "next/link";
import type { LeaderboardIndividual, LeaderboardPeriod } from "@/lib/leaderboard-types";
import styles from "./preview.module.css";

const people = [
  { name: "Maya Chen", color: "#f5cf67", skin: "#e6ac85", hair: "#332c35", monthly: [12, 384, "124000"], all: [64, 1920, "682000"] },
  { name: "Jordan Rivera", color: "#b6d9fb", skin: "#bc7e57", hair: "#272a34", monthly: [9, 312, "98000"], all: [87, 2640, "924000"] },
  { name: "Alex Morgan", color: "#e5bddc", skin: "#f0bf9d", hair: "#986134", monthly: [8, 276, "76000"], all: [51, 1430, "518000"] },
  { name: "Sofia Reyes", color: "#c5dfbd", skin: "#d49a73", hair: "#423139", monthly: [7, 198, "54000"], all: [43, 1210, "426000"] },
  { name: "Ethan Brooks", color: "#f4c2ac", skin: "#f0bf9d", hair: "#614636", monthly: [6, 152, "42000"], all: [36, 960, "312000"] },
  { name: "Bella Park", color: "#c8c5ed", skin: "#e6ac85", hair: "#292937", monthly: [5, 129, "28000"], all: [29, 820, "248000"] },
];
function money(cents: string) {
  const amount = BigInt(cents);
  return `$${(amount / BigInt(100)).toLocaleString("en-US")}.${(amount % BigInt(100)).toString().padStart(2, "0")}`;
}
function Portrait({ name }: { name: string }) {
  const person = people.find(person => person.name === name) ?? people[0];
  return <svg className={styles.portrait} viewBox="0 0 80 80" role="img" aria-label={`${name}'s sample profile picture`}>
    <rect width="80" height="80" rx="24" fill={person.color} />
    <path d="M10 80c2-22 18-29 30-29s28 7 30 29" fill={person.hair} />
    <path d="M32 49h16v14c-5 6-11 6-16 0" fill={person.skin} />
    <path d="M17 36C13 7 66 7 63 36l-3 20H20Z" fill={person.hair} />
    <ellipse cx="40" cy="36" rx="20" ry="24" fill={person.skin} />
    <path d="M19 31c0-24 40-27 43 0-10-3-16-7-21-15-3 10-13 14-22 15" fill={person.hair} />
    <circle cx="32" cy="37" r="2" fill="#302c30" /><circle cx="48" cy="37" r="2" fill="#302c30" />
    <path d="M34 47q6 6 12 0" fill="none" stroke="#784f45" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}
function Trophy() { return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M9 4h14v9c0 6-3 9-7 9s-7-3-7-9ZM9 7H4v4c0 5 3 7 7 7M23 7h5v4c0 5-3 7-7 7M16 22v5M10 28h12" /><path d="m16 8 1 3 3 1-2 2v3l-2-2-2 2v-3l-2-2 3-1Z" fill="currentColor" stroke="none" /></svg>; }

export function LeaderboardPreview() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("monthly");
  const individuals: LeaderboardIndividual[] = people.map((person, index) => {
    const values = period === "monthly" ? person.monthly : person.all;
    return { rank: 0, contributor_id: String(index), name: person.name, profile_photo_url: null, avatars_made: Number(values[0]), total_votes: Number(values[1]), revenue_cents: String(values[2]) };
  }).sort((a, b) => BigInt(a.revenue_cents) > BigInt(b.revenue_cents) ? -1 : 1).map((person, index) => ({ ...person, rank: index + 1 }));
  const podium = [individuals[1], individuals[0], individuals[2]];
  const label = period === "monthly" ? "October 2026" : "All time";
  return <main id="main" className={styles.page}>
    <div className={styles.previewNote}><span><i /> Design preview · Sample data</span><Link href="/leaderboard">Back to leaderboard ↗</Link></div>
    <div className={styles.layout}>
      <section className={styles.center} aria-labelledby="page-title">
        <header className={styles.heading}><p className={styles.eyebrow}>Made by our community</p><h1 id="page-title">Leaderboard<span>★</span></h1><p>Create something great. Make your way to the top.</p></header>
        <section className={styles.podiumSection} aria-label={`${label} top three creators`}>
          <p className={styles.podiumLabel}>{label} <span>· Top creators by revenue</span></p>
          <div className={styles.podium} aria-live="polite">
            {podium.map(person => <div key={person.contributor_id} className={`${styles.winner} ${styles[`place${person.rank}`]}`}>
              <div className={styles.winnerProfile}>{person.rank === 1 && <span className={styles.crown} aria-label="First place">♛</span>}<Portrait name={person.name} /><strong>{person.name}</strong><span className={styles.amount}>{money(person.revenue_cents)}</span></div>
              <div className={styles.step}><span>{person.rank}</span><small>{person.rank === 1 ? "THE TOP SPOT" : person.rank === 2 ? "RUNNER UP" : "THIRD PLACE"}</small></div>
            </div>)}
          </div>
        </section>
        <section className={styles.rankings} aria-labelledby="rankings-title">
          <div className={styles.tableHeading}><div><h2 id="rankings-title">Creator rankings</h2><p>{label} · Ranked by revenue</p></div><div className={styles.toggle} role="group" aria-label="Ranking period">{(["monthly", "all_time"] as const).map(value => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === "monthly" ? "Monthly" : "All Time"}</button>)}</div></div>
          <div className={styles.tableScroll}><table><caption className="visually-hidden">{label} individual leaderboard. Votes count upvotes only.</caption><thead><tr><th scope="col">Rank</th><th scope="col">Creator</th><th scope="col">Avatars made</th><th scope="col">Total upvotes</th><th scope="col">Revenue <small>USD</small></th></tr></thead><tbody>{individuals.map(person => <tr key={person.contributor_id}><td><span className={`${styles.rank} ${person.rank <= 3 ? styles.topRank : ""}`}>{person.rank.toString().padStart(2, "0")}</span></td><th scope="row"><div className={styles.creator}><Portrait name={person.name} /><span>{person.name}</span></div></th><td>{person.avatars_made}</td><td>{person.total_votes.toLocaleString("en-US")}</td><td className={styles.revenue}>{money(person.revenue_cents)}</td></tr>)}</tbody></table></div>
          <p className={styles.footnote}>Published avatars and their upvotes for the selected period. Revenue reflects sales after refunds.</p>
        </section>
      </section>
      <aside className={styles.rail} aria-label="Monthly highlights">
        <section className={`${styles.panel} ${styles.rewards}`} aria-labelledby="rewards-title"><div className={styles.panelHeading}><span className={styles.trophy}><Trophy /></span><div><p className={styles.eyebrow}>October 2026</p><h2 id="rewards-title">Monthly rewards</h2></div></div><p className={styles.panelIntro}>A little extra for the creators with the highest monthly sales.</p><ol className={styles.rewardList}>{[2000, 1000, 500].map((credits, index) => <li key={credits}><span><b>{index + 1}</b><small>{["st", "nd", "rd"][index]} place</small></span><strong>{credits.toLocaleString("en-US")}<small>credits</small></strong></li>)}</ol><p className={styles.rewardNote}>Reward preview · Credits are not awarded here.</p></section>
        <section className={styles.panel} aria-labelledby="avatars-title"><p className={styles.eyebrow}>This month’s favorites</p><h2 id="avatars-title">Top avatars <span>↗</span></h2><p className={styles.panelIntro}>Published this month. Ranked by upvotes.</p><ol className={styles.miniList}>{[{ title: "Cloud Nine", name: "Maya Chen", votes: 128 }, { title: "Little Daydream", name: "Alex Morgan", votes: 112 }, { title: "The Happy Orbit", name: "Jordan Rivera", votes: 96 }].map((avatar, index) => <li key={avatar.title}><span className={styles.miniRank}>{index + 1}</span><Portrait name={avatar.name} /><div className={styles.miniText}><strong>{avatar.title}</strong><small>{avatar.name}</small></div><span className={styles.voteCount}>{avatar.votes}<small>upvotes</small></span></li>)}</ol></section>
        <section className={styles.panel} aria-labelledby="states-title"><p className={styles.eyebrow}>Community, coast to coast</p><h2 id="states-title">Top states <span>✳</span></h2><p className={styles.panelIntro}>States with the highest monthly revenue.</p><ol className={styles.stateList}>{[{ name: "New York", avatars: 19, revenue: "178000" }, { name: "California", avatars: 15, revenue: "140000" }, { name: "Texas", avatars: 13, revenue: "104000" }].map((state, index) => <li key={state.name}><span className={styles.stateRank}>{index + 1}</span><div className={styles.miniText}><strong>{state.name}</strong><small>{state.avatars} avatars contributed</small></div><strong className={styles.stateRevenue}>{money(state.revenue)}</strong></li>)}</ol></section>
        <p className={styles.railNote}>Monthly highlights follow New York time.<br />They stay monthly when you select All Time.</p>
      </aside>
    </div>
  </main>;
}
