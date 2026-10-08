import styles from "./leaderboard.module.css";

export function LeaderboardTitle() {
  return <header className={styles.header}>
    <h1 id="page-title" className={styles.title} aria-label="Leaderboard">
      {Array.from("LEADERBOARD").map((letter, index) => (
        <span key={index} aria-hidden="true">{letter}</span>
      ))}
    </h1>
  </header>;
}
