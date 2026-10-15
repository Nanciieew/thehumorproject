import { GuestLanding } from "./guest-landing";
import { getViewer } from "@/lib/auth/profile";
import { RoastStudio } from "./you-are-a-joke/studio";
import { isUuid } from "@/lib/gallery-types";
export default async function Home({ searchParams }: { searchParams: Promise<{ challenge?: string }> }) {
  const viewer = await getViewer(); const params = await searchParams;
  const provider = process.env.ROAST_PROVIDER ?? "mock";
  if (viewer) return <RoastStudio mock={provider === "mock"} configured={provider === "mock" || (provider === "gemini" && !!process.env.GEMINI_API_KEY && !!process.env.GEMINI_MODEL)} challengeId={isUuid(params.challenge) ? params.challenge : undefined} />;
  return <GuestLanding />;
}
