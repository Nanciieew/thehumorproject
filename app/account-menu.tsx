"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { logout } from "./auth/actions";

export function AccountMenu({ signedIn, name, initials, photoUrl }: { signedIn: boolean; name: string; initials: string; photoUrl: string | null }) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false;
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  return <nav aria-label="Account" className="flex justify-end px-6 pt-6 sm:px-10">
    {signedIn ? <details ref={menu} className="relative z-20">
      <summary aria-label="Open account options" className="flex h-14 w-14 cursor-pointer list-none items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-foreground/10 shadow-md outline-offset-4 [&::-webkit-details-marker]:hidden">
        {photoUrl ? <Image src={photoUrl} alt="Your profile photo" width={56} height={56} unoptimized className="h-full w-full object-cover" /> : <span className="font-semibold">{initials || ":)"}</span>}
      </summary>
      <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-current/10 bg-background p-2 shadow-xl">
        <p className="truncate px-3 py-2 text-sm font-semibold">{name || "Your account"}</p>
        <Link href="/profile" onClick={() => { if (menu.current) menu.current.open = false; }} className="block rounded-lg px-3 py-3 text-sm hover:bg-foreground/5">Profile Settings</Link>
        <form action={logout}><button className="w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-foreground/5">Log out</button></form>
      </div>
    </details> : <Link href="/login" className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white bg-foreground text-xs font-semibold text-background shadow-md">Log in</Link>}
  </nav>;
}
