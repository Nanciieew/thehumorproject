import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { isUuid } from "@/lib/gallery-types";
import { RoastStudio } from "./studio";

export const metadata = { title: "Get Checked | checked" };
export default async function RoastPage({ searchParams }: { searchParams: Promise<{ challenge?: string }> }) {
  const viewer = await getViewer();
  const params = await searchParams;
  const challenge = isUuid(params.challenge) ? params.challenge : undefined;
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/you-are-a-joke${challenge ? `?challenge=${challenge}` : ""}`)}`);
  const provider = process.env.ROAST_PROVIDER ?? "mock";
  return <RoastStudio mock={provider === "mock"} configured={provider === "mock" || (provider === "gemini" && !!process.env.GEMINI_API_KEY && !!process.env.GEMINI_MODEL)} challengeId={challenge} />;
}
