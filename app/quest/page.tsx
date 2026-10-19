import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { DailyQuest } from "../daily-quest";

export const metadata = { title: "Vote | Checkly Quest | checked" };
export default async function QuestVotingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return <DailyQuest userId={viewer.user.id} />;
}
