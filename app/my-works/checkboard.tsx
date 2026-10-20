"use client";

import Link from "next/link";
import { useState } from "react";
import { ChecklyDashboard } from "../checkly-dashboard";
import { WorksGrid } from "./works-grid";
import type { WorksPage } from "@/lib/work-types";
import styles from "./checkboard.module.css";

export function MyCheckboard({ userId, initial }: { userId: string; initial: WorksPage }) {
  const [received, setReceived] = useState(initial.received ?? null);
  return <ChecklyDashboard userId={userId} received={received}>
    <section className={styles.collection} aria-labelledby="collection-title">
      <div className={styles.collectionHeading}><h2 id="collection-title">Uploaded memes</h2><Link className={styles.upload} href="/disguise"><span aria-hidden="true">✳</span>Create new meme</Link></div>
      <WorksGrid initial={initial} onTotalsChange={setReceived} />
    </section>
  </ChecklyDashboard>;
}
