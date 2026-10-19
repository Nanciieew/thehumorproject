import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { DisguiseStudio } from "./studio";

export const metadata = { title: "Checked Factory | checked" };
export default async function DisguisePage() {
  if (!await getViewer()) redirect("/login?next=/disguise");
  return <DisguiseStudio configured={Boolean(process.env.ARK_API_KEY)} />;
}
