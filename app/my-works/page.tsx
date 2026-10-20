import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { readWorks } from "@/lib/works";
import { readCheckboardTotals } from "@/lib/checkboard";
import { ChecklyDashboard } from "../checkly-dashboard";
import { WorksGrid } from "./works-grid";
import { UploadMeme } from "./upload-meme";
import styles from "./checkboard.module.css";

export const metadata = { title: "My Checkboard | checked" };
export default async function MyDashboardPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/my-works");
  const [works, received] = await Promise.all([readWorks(), readCheckboardTotals(viewer.user.id).catch(() => null)]);
  return <ChecklyDashboard userId={viewer.user.id} received={received}>
    <section className={styles.collection} aria-labelledby="collection-title">
      <div className={styles.collectionHeading}><h2 id="collection-title">Uploaded memes</h2><UploadMeme /></div>
      <WorksGrid key={JSON.stringify(works)} initial={works} />
    </section>
  </ChecklyDashboard>;
}
