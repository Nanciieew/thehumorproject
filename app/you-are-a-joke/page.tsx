import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { RoastStudio } from "./studio";

export const metadata = { title: "Get Checked | checked" };
export default async function RoastPage() {
  if (!await getViewer()) redirect("/login?next=/you-are-a-joke");
  const provider = process.env.ROAST_PROVIDER ?? "mock";
  return <RoastStudio mock={provider === "mock"} configured={provider === "mock" || (provider === "gemini" && !!process.env.GEMINI_API_KEY && !!process.env.GEMINI_MODEL)} />;
}
