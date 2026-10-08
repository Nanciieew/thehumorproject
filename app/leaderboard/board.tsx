"use client";

import { useState } from "react";
import Image from "next/image";
import type { LeaderboardPeriod, LeaderboardSummary } from "@/lib/leaderboard-types";
import styles from "./board.module.css";

function money(cents: string) {
  const amount = BigInt(cents);
  return `$${(amount / BigInt(100)).toLocaleString("en-US")}.${(amount % BigInt(100)).toString().padStart(2, "0")}`;
}
function Portrait({ name, url }: { name: string; url: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (url && failedUrl !== url) return <Image className={styles.portrait} src={url} alt={`${name}'s profile picture`} width={80} height={80} unoptimized onError={() => setFailedUrl(url)} />;
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
  return <span className={`${styles.portrait} ${styles.initials}`} role="img" aria-label={`${name}'s profile picture`}>{initials}</span>;
}
function Trophy() { return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M9 4h14v9c0 6-3 9-7 9s-7-3-7-9ZM9 7H4v4c0 5 3 7 7 7M23 7h5v4c0 5-3 7-7 7M16 22v5M10 28h12" /><path d="m16 8 1 3 3 1-2 2v3l-2-2-2 2v-3l-2-2 3-1Z" fill="currentColor" stroke="none" /></svg>; }

export function LeaderboardBoard({ summary, pending = false, onPeriodChange, onLoadMore, onRefresh, error, onRetry }: {
  summary: LeaderboardSummary; pending?: boolean; onPeriodChange: (period: LeaderboardPeriod) => void;
  onLoadMore?: () => void; onRefresh?: () => void; error?: string | null; onRetry?: () => void;
}) {
  const { period, individuals } = summary;
  const podium = [2, 1, 3].map(rank => summary.podium.find(person => person.rank === rank)).filter(person => person !== undefined);
  const month = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "America/New_York" }).format(new Date(summary.month_start));
  const label = period === "monthly" ? month : "All time";
  return <main id="main" className={styles.page}>
    <div className={styles.previewNote}><span>Community rankings · USD</span>{onRefresh && <button type="button" onClick={onRefresh} disabled={pending}>Refresh ↻</button>}</div>
    {error && <div className={styles.error} role="alert">{error} {onRetry && <button type="button" onClick={onRetry} disabled={pending}>Try again</button>}</div>}
    <p className="visually-hidden" role="status">{pending ? "Loading rankings…" : `${label} rankings loaded.`}</p>
    <div className={styles.layout}>
      <section className={styles.center} aria-labelledby="page-title">
        <header className={styles.heading}><p className={styles.eyebrow}>Made by our community</p><h1 id="page-title">Leaderboard<span>★</span></h1><p>Create something great. Make your way to the top.</p></header>
        <section className={styles.podiumSection} aria-label={`${label} top three creators`}>
          <p className={styles.podiumLabel}>{label} <span>· Top creators by revenue</span></p>
          {!podium.length && <p className={styles.empty}>The podium is waiting for our first creators.</p>}
          <div className={styles.podium}>
            {podium.map(person => <div key={person.contributor_id} className={`${styles.winner} ${styles[`place${person.rank}`]}`}>
              <div className={styles.winnerProfile}>{person.rank === 1 && <span className={styles.crown} aria-label="First place">♛</span>}<Portrait name={person.name} url={person.profile_photo_url} /><strong>{person.name}</strong><span className={styles.amount}>{money(person.revenue_cents)}</span></div>
              <div className={styles.step}><span>{person.rank}</span><small>{person.rank === 1 ? "THE TOP SPOT" : person.rank === 2 ? "RUNNER UP" : "THIRD PLACE"}</small></div>
            </div>)}
          </div>
        </section>
        <section className={styles.rankings} aria-labelledby="rankings-title" aria-busy={pending}>
          <div className={styles.tableHeading}><div><h2 id="rankings-title">Creator rankings</h2><p>{label} · Ranked by revenue</p></div><div className={styles.toggle} role="group" aria-label="Ranking period">{(["monthly", "all_time"] as const).map(value => <button key={value} type="button" aria-pressed={period === value} disabled={pending} onClick={() => onPeriodChange(value)}>{value === "monthly" ? "Monthly" : "All Time"}</button>)}</div></div>
          {!individuals.length && <p className={styles.empty}>No creator activity for this period yet. Publish an avatar to get started.</p>}
          <div className={styles.tableScroll}><table><caption className="visually-hidden">{label} individual leaderboard. Votes count upvotes only.</caption><thead><tr><th scope="col">Rank</th><th scope="col">Creator</th><th scope="col">Avatars made</th><th scope="col">Total upvotes</th><th scope="col">Revenue <small>USD</small></th></tr></thead><tbody>{individuals.map(person => <tr key={person.contributor_id}><td><span className={`${styles.rank} ${person.rank <= 3 ? styles.topRank : ""}`}>{person.rank.toString().padStart(2, "0")}</span></td><th scope="row"><div className={styles.creator}><Portrait name={person.name} url={person.profile_photo_url} /><span>{person.name}</span></div></th><td>{person.avatars_made}</td><td>{person.total_votes.toLocaleString("en-US")}</td><td className={styles.revenue}>{money(person.revenue_cents)}</td></tr>)}</tbody></table></div>
          {summary.next_cursor && onLoadMore && <div className={styles.pagination}><button type="button" onClick={onLoadMore} disabled={pending}>{pending ? "Loading…" : "Load more creators"}</button></div>}
          <p className={styles.footnote}>Published avatars and their upvotes for the selected period. Revenue reflects sales after refunds.</p>
        </section>
      </section>
      <aside className={styles.rail} aria-label="Monthly highlights">
        <section className={`${styles.panel} ${styles.rewards}`} aria-labelledby="rewards-title"><div className={styles.panelHeading}><span className={styles.trophy}><Trophy /></span><div><p className={styles.eyebrow}>{month}</p><h2 id="rewards-title">Monthly rewards</h2></div></div><p className={styles.panelIntro}>A little extra for the creators with the highest monthly sales.</p><ol className={styles.rewardList}>{summary.monthly_rewards.map(({ rank, credits }) => <li key={rank}><span><b>{rank}</b><small>{["st", "nd", "rd"][rank - 1]} place</small></span><strong>{credits.toLocaleString("en-US")}<small>credits</small></strong></li>)}</ol><p className={styles.rewardNote}>Monthly reward amounts · Display only.</p></section>
        <section className={styles.panel} aria-labelledby="avatars-title"><p className={styles.eyebrow}>This month’s favorites</p><h2 id="avatars-title">Top avatars <span>↗</span></h2><p className={styles.panelIntro}>Published this month. Ranked by upvotes.</p>{!summary.monthly_top_avatars.length && <p className={styles.empty}>No avatars published this month yet.</p>}<ol className={styles.miniList}>{summary.monthly_top_avatars.map(avatar => <li key={avatar.id}><span className={styles.miniRank}>{avatar.rank}</span><Portrait name={avatar.name} url={avatar.profile_photo_url} /><div className={styles.miniText}><strong>{avatar.title || "Untitled avatar"}</strong><small>{avatar.name}</small></div><span className={styles.voteCount}>{avatar.upvotes.toLocaleString("en-US")}<small>upvotes</small></span></li>)}</ol></section>
        <section className={styles.panel} aria-labelledby="states-title"><p className={styles.eyebrow}>Community, coast to coast</p><h2 id="states-title">Top states <span>✳</span></h2><p className={styles.panelIntro}>States with the highest monthly revenue.</p>{!summary.monthly_top_regions.length && <p className={styles.empty}>No state activity this month yet.</p>}<ol className={styles.stateList}>{summary.monthly_top_regions.map(state => <li key={state.state_code}><span className={styles.stateRank}>{state.rank}</span><div className={styles.miniText}><strong>{state.state_name}</strong><small>{state.avatars_contributed} avatars contributed</small></div><strong className={styles.stateRevenue}>{money(state.revenue_cents)}</strong></li>)}</ol></section>
        <p className={styles.railNote}>Monthly highlights follow New York time.<br />They stay monthly when you select All Time.</p>
      </aside>
    </div>
  </main>;
}
