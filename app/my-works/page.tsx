import { PlayfulTitle } from "../playful-title";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { readWorks } from "@/lib/works";
import { readDashboard } from "@/lib/dashboard";
import { WorksGrid } from "./works-grid";
import { egoRead } from "@/lib/ego/server";
import type { CompetitionSummary } from "@/lib/ego/types";
import Link from "next/link";
import { DashboardStats } from "./dashboard-stats";
import styles from "./dashboard.module.css";

export const metadata = { title: "My Damage Report | Ego Check" };
export default async function MyDashboardPage() {
  if (!await getViewer()) redirect("/login");
  const [works, summary] = await Promise.all([readWorks(), readDashboard().catch(() => null)]);
  const competition = await egoRead<CompetitionSummary>("summary").catch(() => null);
  return <main id="main">
    <header className="page-hero works-hero"><div><PlayfulTitle text="My Damage Report" /></div></header>
    <section className="ego-panel"><h2>Battles</h2>{competition ? <div className="ego-steps"><article><b>{competition.wins} public wins</b></article><article><b>{competition.active} active battles</b></article><article><b>{competition.invitations} invitations</b><Link href="/challenges?scope=mine">View →</Link></article></div> : <p>Battle totals unavailable.</p>}</section>
    <DashboardStats initial={summary} />
    <section className="gallery-section works-section" aria-labelledby="collection-title"><div className={styles.collection}><div><h2 id="collection-title">Your evidence</h2><p>Your photos and shared results.</p></div></div><WorksGrid initial={works} /></section>
  </main>;
}
