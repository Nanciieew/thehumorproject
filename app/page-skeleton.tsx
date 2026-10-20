import styles from "./page-skeleton.module.css";

export function FeedSkeleton({ label = "Loading memes…" }: { label?: string }) {
  return <div aria-busy="true"><p role="status" className={styles.status}>{label}</p>
    <div className={styles.grid} aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <div key={index} className={styles.card}><div /><span /></div>)}</div>
  </div>;
}

export function PageSkeleton({ title, studio = false }: { title: string; studio?: boolean }) {
  return <main id="main" className={styles.page} aria-busy="true"><h1>{title}</h1>
    {studio ? <><p role="status" className={styles.status}>Getting your studio ready…</p><div className={styles.studio} aria-hidden="true"><div /><div /></div></>
      : <FeedSkeleton label={`Loading ${title === "My Checkboard" ? "your Checkboard" : "memes"}…`} />}
  </main>;
}
