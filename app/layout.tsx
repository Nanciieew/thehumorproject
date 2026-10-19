import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { AppHeader } from "./app-header";
import { Sidebar } from "./sidebar";
import { getAuthViewer } from "@/lib/auth/profile";
import { profilePhotoUrl } from "@/lib/profile-photo";
import { AccountMenu } from "./account-menu";
import { Onboarding } from "./onboarding";
import "./globals.css";
import "./ego.css";

const inter = localFont({ src: "./fonts/inter.ttf", variable: "--font-inter", weight: "100 900", display: "swap" });
const anton = localFont({ src: "./fonts/anton.ttf", variable: "--font-anton", weight: "400", display: "swap" });

export const metadata: Metadata = {
  title: "checked | Finally, an app that sees the problem",
  description: "Rate fresh memes, create your own, and get checked.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getAuthViewer();
  const profile = session?.profile;
  const viewer = profile?.onboarding_completed_at ? session : null;
  const photoUrl = await profilePhotoUrl(profile?.avatar_path ?? null);
  return (
    <html
      lang="en"
      className={`${inter.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <a href="#main" className="skip-link">Skip to content</a>
        <div className={viewer ? "app-shell" : "app-shell guest-shell"}>
          {viewer && <Sidebar><AccountMenu signedIn name={[profile?.first_name, profile?.last_name].filter(Boolean).join(" ")} initials={`${profile?.first_name?.slice(0, 1) ?? ""}${profile?.last_name?.slice(0, 1) ?? ""}`} photoUrl={photoUrl} /></Sidebar>}
          <div className="site-content">
            <AppHeader>{!viewer ? <AccountMenu signedIn={false} name="" initials="" photoUrl={null} /> : undefined}</AppHeader>
            {!viewer && <nav className="ego-guest-nav" aria-label="Public navigation"><Link href="/">Checkly Quest</Link><Link href="/gallery">Checked Gallery</Link><Link href="/disguise">Checked Factory</Link><Link href="/you-are-a-joke">Get Checked</Link><Link href="/my-works">My Checkboard</Link></nav>}
            {children}
            <footer className="app-footer"><Link href="/">checked <span>© 2026</span></Link><Link href={viewer ? "/profile" : "/login"}>{viewer ? "Profile" : "Sign in"}</Link></footer>
          </div>
        </div>
        {session && !viewer && <Onboarding firstName={profile?.first_name ?? ""} lastName={profile?.last_name ?? ""} stateCode={profile?.state_code ?? ""} />}
      </body>
    </html>
  );
}
