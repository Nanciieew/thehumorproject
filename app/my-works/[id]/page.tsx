import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { readWork } from "@/lib/works";
import { CaptionEditor } from "./caption-editor";

export const metadata = { title: "Edit Work | The Humor Project" };
export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  if (!await getViewer()) redirect("/login");
  const work = await readWork((await params).id); if (!work) notFound();
  return <main id="main" className="work-detail">
    <Link href="/my-works" className="text-button">← Back to My Dashboard</Link>
    <div className="work-detail-layout">
      <div className="work-detail-photo"><Image src={work.photo_url} alt={work.title || "Your work"} width={1200} height={1200} unoptimized /></div>
      <section><p className="eyebrow">{work.photo_id ? "PUBLISHED WORK" : "PRIVATE WORK"}</p><h1>Tell its story.</h1>
        <p className="work-detail-note">{work.photo_id ? "The work’s name and description appear with this work in the gallery." : "This work and its captions stay private until you publish it."}</p>
        <CaptionEditor work={work} />
      </section>
    </div>
  </main>;
}
