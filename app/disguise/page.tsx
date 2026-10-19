import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { DisguiseStudio } from "./studio";

export const metadata = { title: "Checked Factory | checked" };
export default async function DisguisePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/disguise");
  return <DisguiseStudio userId={viewer.user.id} configured={Boolean(process.env.ARK_API_KEY && process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL)} />;
}
