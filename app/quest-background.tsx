import styles from "./quest-background.module.css";

/** The approved 3D artwork, isolated from its mockup's non-interactive UI. */
export function QuestBackground() {
  return <div className={styles.scene} aria-hidden="true"><div className={styles.artwork} /><div className={styles.light} /></div>;
}
