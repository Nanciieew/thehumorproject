import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readPublicAvatar } from "@/lib/gallery-avatar";
import styles from "./avatar.module.css";

export const metadata = { title: "Avatar Details | The Humor Project" };

export default async function AvatarPage({ params }: { params: Promise<{ id: string }> }) {
  const avatar = await readPublicAvatar((await params).id);
  if (!avatar) notFound();
  return <main id="main" className={styles.page}>
    <Link href={`/#photo-${avatar.id}`} className="text-button">← Back to Avatar Gallery</Link>
    <div className={styles.layout}>
      <div className={styles.image}><Image src={avatar.photo_url} alt={avatar.title || `Avatar by ${avatar.name}`} width={1200} height={1200} unoptimized /></div>
      <section className={styles.story}>
        <h1>{avatar.title || avatar.name}</h1>
        <p className={styles.creator}>By {avatar.name}</p>
        <h2>Description</h2>
        <p className={styles.description}>{avatar.description || "This avatar doesn’t have a description yet."}</p>
      </section>
    </div>
  </main>;
}
