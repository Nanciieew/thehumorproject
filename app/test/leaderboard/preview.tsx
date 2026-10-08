"use client";

import { useState } from "react";
import { LeaderboardBoard } from "../../leaderboard/board";
import type { LeaderboardIndividual, LeaderboardPeriod, LeaderboardSummary } from "@/lib/leaderboard-types";
import styles from "./preview.module.css";

const people = [
  { name: "Maya Chen", color: "#f5cf67", skin: "#e6ac85", hair: "#332c35", monthly: [12, 384, "124000"], all: [64, 1920, "682000"] },
  { name: "Jordan Rivera", color: "#b6d9fb", skin: "#bc7e57", hair: "#272a34", monthly: [9, 312, "98000"], all: [87, 2640, "924000"] },
  { name: "Alex Morgan", color: "#e5bddc", skin: "#f0bf9d", hair: "#986134", monthly: [8, 276, "76000"], all: [51, 1430, "518000"] },
  { name: "Sofia Reyes", color: "#c5dfbd", skin: "#d49a73", hair: "#423139", monthly: [7, 198, "54000"], all: [43, 1210, "426000"] },
  { name: "Ethan Brooks", color: "#f4c2ac", skin: "#f0bf9d", hair: "#614636", monthly: [6, 152, "42000"], all: [36, 960, "312000"] },
  { name: "Bella Park", color: "#c8c5ed", skin: "#e6ac85", hair: "#292937", monthly: [5, 129, "28000"], all: [29, 820, "248000"] },
];
export function LeaderboardPreview() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("monthly");
  const [replay, setReplay] = useState(0);
  const individuals: LeaderboardIndividual[] = people.map((person, index) => {
    const values = period === "monthly" ? person.monthly : person.all;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="24" fill="${person.color}"/><circle cx="40" cy="36" r="23" fill="${person.skin}"/><path d="M17 29Q19 4 40 10Q64 8 63 30L40 19Z" fill="${person.hair}"/><circle cx="32" cy="36" r="2"/><circle cx="48" cy="36" r="2"/><path d="M32 46Q40 54 48 46" fill="none" stroke="#784f45" stroke-width="2"/><path d="M12 80Q13 59 40 59Q67 59 68 80" fill="${person.hair}"/></svg>`;
    return { rank: 0, contributor_id: String(index), name: person.name, profile_photo_url: `data:image/svg+xml,${encodeURIComponent(svg)}`, avatars_made: Number(values[0]), total_votes: Number(values[1]), revenue_cents: String(values[2]) };
  }).sort((a, b) => BigInt(a.revenue_cents) > BigInt(b.revenue_cents) ? -1 : 1).map((person, index) => ({ ...person, rank: index + 1 }));
  const summary: LeaderboardSummary = {
    period, as_of: "2026-10-08T12:00:00Z", month_start: "2026-10-01T04:00:00Z", month_end: "2026-11-01T04:00:00Z",
    individuals, podium: individuals.slice(0, 3), monthly_top_avatars: [], monthly_top_regions: [],
    monthly_rewards: [{rank: 1, credits: 2000}, {rank: 2, credits: 1000}, {rank: 3, credits: 500}], next_cursor: null,
  };
  return <>
    <div className={styles.previewNote} style={{padding: "16px 32px 0"}}><span>Animation preview · Sample data</span><button className="secondary-button" type="button" onClick={() => setReplay(value => value + 1)}>Replay animation ↻</button></div>
    <LeaderboardBoard key={replay} summary={summary} onPeriodChange={setPeriod} />
  </>;
}
