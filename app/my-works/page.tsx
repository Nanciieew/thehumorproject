import { PlayfulTitle } from "../playful-title";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { readWorks } from "@/lib/works";
import { readDashboard } from "@/lib/dashboard";
import { WorksGrid } from "./works-grid";
import { DashboardStats } from "./dashboard-stats";
import styles from "./dashboard.module.css";

export const metadata = { title: "My Checkboard | checked" };
export default async function MyDashboardPage() {
  if (!await getViewer()) redirect("/login");
  const [works, summary] = await Promise.all([readWorks(), readDashboard().catch(() => null)]);
  return <main id="main">
    <header className="page-hero works-hero"><div><PlayfulTitle text="My Checkboard" /></div></header>
    <DashboardStats initial={summary} />
    <section className="gallery-section works-section" aria-labelledby="collection-title"><div className={styles.collection}><div><h2 id="collection-title">Your evidence</h2><p>Your photos and shared results.</p></div></div><WorksGrid initial={works} /></section>
  </main>;
}
