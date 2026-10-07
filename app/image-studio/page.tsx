import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { ImageStudio } from "./studio";

export const metadata: Metadata = { title: "Image Studio | The Humor Project" };

export default async function ImageStudioPage() {
  if (!await getViewer()) redirect("/login");
  return <ImageStudio configured={Boolean(process.env.ARK_API_KEY)} />;
}
