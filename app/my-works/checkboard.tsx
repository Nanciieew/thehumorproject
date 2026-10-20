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
      <WorksGrid initial={initial} onTotalsChange={setReceived}
        heading={<h2 id="collection-title">Uploaded memes</h2>}
        action={<Link className={styles.upload} href="/disguise"><span aria-hidden="true">✳</span>Create New Meme</Link>} />
    </section>
  </ChecklyDashboard>;
}
