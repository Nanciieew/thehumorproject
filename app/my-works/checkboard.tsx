"use client";

import Link from "next/link";
import { Suspense, use, useEffect, useState } from "react";
import { ChecklyDashboard } from "../checkly-dashboard";
import { WorksGrid } from "./works-grid";
import type { WorksPage } from "@/lib/work-types";
import styles from "./checkboard.module.css";
import { ContentLoading } from "../loading-indicator";

type InitialWorks = WorksPage | Promise<WorksPage>;
type Totals = NonNullable<WorksPage["received"]>;

function Collection({ initial, onTotalsChange }: { initial: InitialWorks; onTotalsChange: (totals: Totals) => void }) {
  const page = "then" in initial ? use(initial) : initial;
  useEffect(() => { if (page.received) onTotalsChange(page.received); }, [page, onTotalsChange]);
  return <WorksGrid key={JSON.stringify(page)} initial={page} onTotalsChange={onTotalsChange}
    heading={<h2 id="collection-title">Uploaded memes</h2>}
    action={<Link className={styles.upload} href="/disguise"><span aria-hidden="true">✳</span>Create New Meme</Link>} />;
}

export function MyCheckboard({ userId, initial }: { userId: string; initial: InitialWorks }) {
  const [received, setReceived] = useState("then" in initial ? undefined : initial.received);
  return <ChecklyDashboard userId={userId} received={received}>
    <section className={styles.collection} aria-labelledby="collection-title">
      <Suspense fallback={<ContentLoading label="Loading your memes…" />}>
        <Collection initial={initial} onTotalsChange={setReceived} />
      </Suspense>
    </section>
  </ChecklyDashboard>;
}
