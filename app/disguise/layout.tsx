import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getViewer } from "@/lib/auth/profile";
import { DisguiseStudio } from "./studio";

export default async function FactoryLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/disguise");
  return <>{children}<DisguiseStudio userId={viewer.user.id} configured={Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL)} /></>;
}
