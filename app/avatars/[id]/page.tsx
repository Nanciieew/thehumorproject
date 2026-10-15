import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readPublicAvatar } from "@/lib/gallery-avatar";
import styles from "./avatar.module.css";

export const metadata = { title: "Avatar Details | Ego Check" };

export default async function AvatarPage({ params }: { params: Promise<{ id: string }> }) {
  const avatar = await readPublicAvatar((await params).id);
  if (!avatar) notFound();
  return <main id="main" className={styles.page}>
    <Link href={`/gallery#photo-${avatar.id}`} className="text-button">← Back to Public Evidence</Link>
    <div className={styles.layout}>
      <div className={styles.image}><Image src={avatar.photo_url} alt={avatar.title || `Avatar by ${avatar.name}`} width={1200} height={1200} unoptimized /></div>
      <section className={styles.story}>
        <h1>{avatar.title || avatar.name}</h1>
        <p className={styles.creator}>By {avatar.name}</p>
        {avatar.result && <p>Battle votes: {avatar.result.battle_votes} · {avatar.result.outcome}. Gallery upvotes are separate from the completed battle.</p>}
        {avatar.result && <blockquote className={styles.description}>{avatar.result.roast}</blockquote>}
        <h2>{avatar.result ? "Owner’s note" : "Description"}</h2>
        <p className={styles.description}>{avatar.description || "This avatar doesn’t have a description yet."}</p>
      </section>
    </div>
  </main>;
}
