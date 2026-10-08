"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ColorPlay } from "./ui";

export function AppHeader({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const title = pathname.startsWith("/image-studio") ? "CREATE / IMAGE STUDIO" : pathname.startsWith("/marketplace") ? "交易广场" : pathname.startsWith("/my-works") ? "CREATIVITY / MY WORKS" : pathname.startsWith("/leaderboard") ? "COMMUNITY / LEADERBOARD" : pathname.startsWith("/profile") ? "PERSONALITY / YOUR PROFILE" : pathname.startsWith("/login") ? "WELCOME / THE HUMOR PROJECT" : "COMMUNITY / AVATAR GALLERY";
  return <header className="app-topbar"><span className="topbar-title"><ColorPlay />{title}</span>{children ?? <span className="topbar-note">GOOD PEOPLE. GREAT PERSONALITY.</span>}</header>;
}
