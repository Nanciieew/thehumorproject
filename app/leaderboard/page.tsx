import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { Icon } from "../ui";
import styles from "./leaderboard.module.css";

export const metadata: Metadata = { title: "Leaderboard | The Humor Project" };

export default async function LeaderboardPage() {
  if (!await getViewer()) redirect("/login");
  return <main id="main">
    <header className={styles.header}>
      <h1 className={styles.title} aria-label="Leaderboard">
        {Array.from("LEADERBOARD").map((letter, index) => (
          <span key={index} aria-hidden="true">{letter}</span>
        ))}
      </h1>
    </header>
    <section className="leaderboard-placeholder" aria-labelledby="leaderboard-title">
      <svg className="trophy-art" viewBox="0 0 180 170" aria-hidden="true" stroke="var(--foreground)" strokeWidth="1.5"><path d="M52 29h76v45c0 31-17 47-38 47S52 105 52 74Z" fill="var(--beige)" /><path d="M52 40H28v19c0 24 12 38 31 38m69-57h24v19c0 24-12 38-31 38M90 121v26m-25 8v-8h50v8Z" fill="none" /><path d="m90 46 5 15 16 1-13 10 4 16-12-9-13 9 4-16-12-10 16-1Z" fill="var(--pink)" /></svg>
      <span className="coming-soon">COMING SOON</span><h2 id="leaderboard-title">A PLACE FOR OUR<br />COMMUNITY STARS.</h2><p>The leaderboard is on its way.<br />For now, keep sharing, keep creating, and keep being you.</p><Link href="/" className="action-button">Meet the community <span><Icon name="arrow" /></span></Link>
    </section>
  </main>;
}
