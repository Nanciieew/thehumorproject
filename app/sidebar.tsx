"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home", description: "Jokes", icon: "home" },
  { href: "/profile", label: "Profile", description: "Your name & photo", icon: "profile" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="border-b border-current/10 bg-foreground/[0.025] md:sticky md:top-0 md:h-dvh md:border-r md:border-b-0">
      <div className="px-5 pt-6 pb-4 md:px-6 md:pt-10 md:pb-8">
        <Link href="/" className="inline-flex items-center gap-3 rounded-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4">
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-xl text-background">:)</span>
          <span>The Humor<br className="hidden md:block" /> Project</span>
        </Link>
      </div>
      <nav aria-label="Main navigation" className="grid grid-cols-2 gap-2 px-3 pb-4 md:grid-cols-1 md:px-4">
        {links.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${active ? "bg-foreground text-background" : "hover:bg-foreground/5"}`}>
              <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {link.icon === "home" ? <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h5v-6h4v6h5V9" /></> : <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>}
              </svg>
              <span><span className="block text-sm font-semibold">{link.label}</span><span className="mt-0.5 hidden text-xs opacity-65 sm:block">{link.description}</span></span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
