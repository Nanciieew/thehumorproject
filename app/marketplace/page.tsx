import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";

export const metadata: Metadata = { title: "Marketplace | The Humor Project" };

export default async function MarketplacePage() {
  if (!await getViewer()) redirect("/login");
  return <main id="main" aria-label="Marketplace" className="min-h-[60vh]" />;
}
