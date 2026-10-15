import Link from "next/link";
import { getViewer } from "@/lib/auth/profile";
import { RoastStudio } from "./you-are-a-joke/studio";
import { isUuid } from "@/lib/gallery-types";
export default async function Home({ searchParams }: { searchParams: Promise<{ challenge?: string }> }) {
  const viewer = await getViewer(); const params = await searchParams;
  const provider = process.env.ROAST_PROVIDER ?? "mock";
  if (viewer) return <RoastStudio mock={provider === "mock"} configured={provider === "mock" || (provider === "gemini" && !!process.env.GEMINI_API_KEY && !!process.env.GEMINI_MODEL)} challengeId={isUuid(params.challenge) ? params.challenge : undefined} />;
  return <main id="main" className="ego-page"><section className="ego-landing"><div><h1>Your ego called.<br /><em>We declined.</em></h1><p className="ego-lead">Get roasted. Challenge a friend. Let the crowd judge.</p><Link className="ego-button" href="/login">Check my ego ↗</Link><Link className="ego-link" href="/challenges">Watch the battles →</Link><p className="ego-note">Your camera stays off until you consent.</p></div><div className="ego-cover" aria-hidden="true"><strong>MAIN<br />CHARACTER.<br /><i>MINOR<br />ISSUE.</i></strong></div></section></main>;
}
