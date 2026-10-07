"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, Smile } from "./ui";

const links = [
  { href: "/", label: "Avatar Gallery", icon: "grid" as const },
  { href: "/image-studio", label: "Image Studio", icon: "spark" as const },
  { href: "/leaderboard", label: "Leaderboard", icon: "leaderboard" as const },
];

export function Sidebar({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  return <aside className="app-sidebar">
    <Link href="/" className="app-brand" aria-label="The Humor Project home"><Smile className="brand-mark" /><span>THE HUMOR<br />PROJECT<small>A little less serious.</small></span></Link>
    <p className="nav-label">YOUR LITTLE CORNER</p>
    <nav aria-label="Main navigation" className="sidebar-links">{links.map((link) => {
      const active = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`);
      return <Link key={link.href} href={link.href} aria-label={link.label} aria-current={active ? "page" : undefined} className={active ? "active" : ""}><Icon name={link.icon} /><span>{link.label}</span><span className="nav-arrow" aria-hidden="true">↗</span></Link>;
    })}</nav>
    <div className="sidebar-doodle" aria-hidden="true"><svg viewBox="0 0 180 170"><path d="M15 142c38-27 36-79 65-83s14 74 57 46 23-62 11-67m-1 1 3 24m-3-24-21 12" fill="none" stroke="currentColor" strokeWidth="1.5" /><text x="16" y="160" fill="currentColor" fontSize="12">make yourself at home.</text><path d="m68 16 5 13 14 2-12 8 2 15-10-9-14 7 4-15-9-8 15-1Z" fill="var(--pink)" stroke="currentColor" strokeWidth="1.5" /></svg></div>
    {children}
  </aside>;
}
