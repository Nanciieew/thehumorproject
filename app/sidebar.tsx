"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon, Smile } from "./ui";

const links = [
  { href: "/", label: "Avatar Gallery", icon: "grid" as const },
  { href: "/image-studio", label: "Image Studio", icon: "spark" as const },
  { href: "/marketplace", label: "Marketplace", icon: "marketplace" as const },
  { href: "/my-works", label: "My Dashboard", icon: "works" as const },
  { href: "/leaderboard", label: "Leaderboard", icon: "leaderboard" as const },
];

export function Sidebar({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const collapsed = !pinnedOpen && !hovered;
  return <aside id="sidebar-panel" className="app-sidebar" data-collapsed={collapsed}
    onPointerEnter={(event) => {
      if (event.pointerType === "mouse") setHovered(true);
    }}
    onPointerLeave={() => setHovered(false)}>
    <div className="sidebar-heading">
      <Link href="/" className="app-brand" aria-label="The Humor Project home" title={collapsed ? "The Humor Project" : undefined}><Smile className="brand-mark" /><span>THE HUMOR<br />PROJECT<small>A little less serious.</small></span></Link>
      <button type="button" className="sidebar-toggle" aria-label={pinnedOpen ? "Unpin sidebar" : "Pin sidebar open"} title={pinnedOpen ? "Unpin sidebar" : "Pin sidebar open"} aria-expanded={!collapsed} aria-pressed={pinnedOpen} aria-controls="sidebar-panel" onClick={() => setPinnedOpen((value) => !value)}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /><path d={collapsed ? "m13 9 3 3-3 3" : "m16 9-3 3 3 3"} /></svg>
      </button>
    </div>
    <p className="nav-label">YOUR LITTLE CORNER</p>
    <nav aria-label="Main navigation" className="sidebar-links">{links.map((link) => {
      const active = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`);
      return <Link key={link.href} href={link.href} aria-label={link.label} title={collapsed ? link.label : undefined} aria-current={active ? "page" : undefined} className={active ? "active" : ""}><Icon name={link.icon} /><span>{link.label}</span><span className="nav-arrow" aria-hidden="true">↗</span></Link>;
    })}</nav>
    <div className="sidebar-doodle" aria-hidden="true"><svg viewBox="0 0 180 170"><path d="M15 142c38-27 36-79 65-83s14 74 57 46 23-62 11-67m-1 1 3 24m-3-24-21 12" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="151" cy="90" r="6" fill="var(--play-blue)" /><circle cx="28" cy="61" r="5" fill="var(--play-red)" /><text x="16" y="160" fill="currentColor" fontSize="12">make yourself at home.</text><path d="m68 16 5 13 14 2-12 8 2 15-10-9-14 7 4-15-9-8 15-1Z" fill="var(--play-orange)" stroke="currentColor" strokeWidth="1.5" /></svg></div>
    {children}
  </aside>;
}
