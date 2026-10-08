import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";

export const metadata: Metadata = { title: "交易广场 | The Humor Project" };

export default async function MarketplacePage() {
  if (!await getViewer()) redirect("/login");
  return <main id="main" aria-label="交易广场" className="min-h-[60vh]" />;
}
