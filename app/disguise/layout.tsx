import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { getViewer } from "@/lib/auth/profile";
import { DisguiseStudio } from "./studio";
import { PageSkeleton } from "../page-skeleton";

async function FactorySession({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/disguise");
  return <>{children}<DisguiseStudio userId={viewer.user.id} configured={Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL)} /></>;
}

export default function FactoryLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageSkeleton title="Checked Factory" studio />}><FactorySession>{children}</FactorySession></Suspense>;
}
