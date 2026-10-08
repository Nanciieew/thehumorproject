import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { readWorks } from "@/lib/works";
import { WorksGrid } from "./works-grid";

export const metadata = { title: "My Works | The Humor Project" };
export default async function MyWorksPage() {
  if (!await getViewer()) redirect("/login");
  return <main id="main">
    <header className="page-hero works-hero"><div><p className="eyebrow">YOUR PERSONAL COLLECTION</p><h1>My <em>Works.</em></h1><p>Your ideas, all in one place. Open a work to give it a name and a story.</p></div></header>
    <section className="gallery-section works-section"><WorksGrid initial={await readWorks()} /></section>
  </main>;
}
