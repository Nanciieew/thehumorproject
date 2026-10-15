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

export const metadata = { title: "Your Damage Report | Ego Check" };
export default async function MyDashboardPage() {
  if (!await getViewer()) redirect("/login");
  const [works, summary] = await Promise.all([readWorks(), readDashboard().catch(() => null)]);
  const competition = await egoRead<CompetitionSummary>("summary").catch(() => null);
  return <main id="main">
    <header className="page-hero works-hero"><div><p className="eyebrow">YOUR PERSONAL DASHBOARD</p><PlayfulTitle text="Your Damage Report" /><p>A paper trail of your questionable decisions. Your actual votes, photos, and revenue.</p></div></header>
    <section className="ego-panel"><h2>Your competitive damage.</h2>{competition ? <div className="ego-steps"><article><b>{competition.wins} public wins</b><p>Qualifying victories, one per opponent per week.</p></article><article><b>{competition.active} active battles</b><p>Your ego has unfinished business.</p></article><article><b>{competition.invitations} invitations</b><Link href="/challenges?scope=mine">Open your challenges →</Link></article></div> : <p>Competition totals are unavailable. Your existing financial and gallery totals are shown below.</p>}</section>
    <DashboardStats initial={summary} />
    <section className="gallery-section works-section" aria-labelledby="collection-title"><div className={styles.collection}><div><h2 id="collection-title">Your evidence</h2><p>Published avatars and private drafts. Open a work to edit its name and story.</p></div></div><WorksGrid initial={works} /></section>
  </main>;
}
