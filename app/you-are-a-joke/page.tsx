import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { RoastStudio } from "./studio";
export const metadata: Metadata = { title: "You Are a Joke | The Humor Project" };
export default async function RoastPage() {
  if (!await getViewer()) redirect("/login");
  const provider = process.env.ROAST_PROVIDER ?? "mock";
  const configured = provider === "mock" || (provider === "gemini" && !!process.env.GEMINI_API_KEY && !!process.env.GEMINI_MODEL);
  return <RoastStudio mock={provider === "mock"} configured={configured} />;
}
