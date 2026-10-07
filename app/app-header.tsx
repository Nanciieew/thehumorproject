"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function AppHeader({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const title = pathname.startsWith("/image-studio") ? "CREATE / IMAGE STUDIO" : pathname.startsWith("/leaderboard") ? "COMMUNITY / LEADERBOARD" : pathname.startsWith("/profile") ? "PERSONALITY / YOUR PROFILE" : pathname.startsWith("/login") ? "WELCOME / THE HUMOR PROJECT" : "COMMUNITY / AVATAR GALLERY";
  return <header className="app-topbar"><span>{title}</span>{children ?? <span className="topbar-note">GOOD PEOPLE. GREAT PERSONALITY.</span>}</header>;
}
