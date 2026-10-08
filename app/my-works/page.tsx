import { PlayfulTitle } from "../playful-title";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { readWorks } from "@/lib/works";
import { readDashboard } from "@/lib/dashboard";
import { WorksGrid } from "./works-grid";
import { DashboardStats } from "./dashboard-stats";
import styles from "./dashboard.module.css";

export const metadata = { title: "My Dashboard | The Humor Project" };
export default async function MyDashboardPage() {
  if (!await getViewer()) redirect("/login");
  const [works, summary] = await Promise.all([readWorks(), readDashboard().catch(() => null)]);
  return <main id="main">
    <header className="page-hero works-hero"><div><p className="eyebrow">YOUR PERSONAL DASHBOARD</p><PlayfulTitle text="My Dashboard" /><p>Your creative journey, from your first publish to your latest sale.</p></div></header>
    <DashboardStats initial={summary} />
    <section className="gallery-section works-section" aria-labelledby="collection-title"><div className={styles.collection}><div><h2 id="collection-title">Your works</h2><p>Published avatars and private drafts. Open a work to edit its name and story.</p></div></div><WorksGrid initial={works} /></section>
  </main>;
}
