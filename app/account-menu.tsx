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
  return <nav aria-label="Account" className={signedIn ? "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 z-40" : "flex justify-end px-6 pt-6 sm:px-10"}>
    {signedIn ? <details ref={menu} className="relative z-20">
      <summary aria-label="Open account options" title={name || "Your account"} className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl bg-background shadow-sm outline-offset-4 hover:bg-foreground/5 [&::-webkit-details-marker]:hidden">
        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white bg-violet-600 text-xs font-medium text-white">
          {photoUrl ? <Image src={photoUrl} alt="Your profile photo" width={32} height={32} unoptimized className="h-full w-full object-cover" /> : <span>{initials || ":)"}</span>}
        </span>
      </summary>
      <div className="absolute bottom-0 left-full ml-3 w-60 max-w-[calc(100vw-5rem)] rounded-2xl border border-current/10 bg-background p-2 shadow-xl">
        <Link href="/profile" onClick={() => { if (menu.current) menu.current.open = false; }} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-foreground/5">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="9" r="3" /><path d="M5.8 18.5a6.5 6.5 0 0 1 12.4 0" /></svg>
          Profile
        </Link>
        <form action={logout}><button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-foreground/5">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M9 12h12m-4-4 4 4-4 4" /></svg>
          Log out
        </button></form>
      </div>
    </details> : <Link href="/login" className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white bg-foreground text-xs font-semibold text-background shadow-md">Log in</Link>}
  </nav>;
}
