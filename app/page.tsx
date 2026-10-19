import { GuestLanding } from "./guest-landing";
import { getViewer } from "@/lib/auth/profile";
import { DailyQuest } from "./daily-quest";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/gallery-types";

export default async function Home({ searchParams }: { searchParams: Promise<{ challenge?: string }> }) {
  const viewer = await getViewer();
  const params = await searchParams;
  if (viewer && isUuid(params.challenge)) redirect(`/you-are-a-joke?challenge=${params.challenge}`);
  return viewer ? <DailyQuest userId={viewer.user.id} /> : <GuestLanding />;
}
