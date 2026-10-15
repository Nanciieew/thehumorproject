"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ColorPlay } from "./ui";

export function AppHeader({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const title = pathname === "/" ? "EGO CHECK / GET CHECKED" : pathname.startsWith("/challenges") ? "THE ARENA / PUBLIC OPINION" : pathname.startsWith("/gallery") || pathname.startsWith("/avatars") ? "PUBLIC EVIDENCE" : pathname.startsWith("/my-works") ? "YOUR DAMAGE REPORT" : pathname.startsWith("/leaderboard") ? "HALL OF SHAME" : pathname.startsWith("/friends") ? "FRIENDS / BAD INFLUENCES" : pathname.startsWith("/profile") ? "THE USUAL SUSPECT" : "EGO CHECK";
  return <header className="app-topbar"><span className="topbar-title"><ColorPlay />{title}</span>{children ?? <span className="topbar-note">FINALLY, AN APP THAT SEES THE PROBLEM.</span>}</header>;
}
