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

const inter = localFont({ src: "./fonts/inter.ttf", variable: "--font-inter", weight: "100 900", display: "swap" });
const anton = localFont({ src: "./fonts/anton.ttf", variable: "--font-anton", weight: "400", display: "swap" });

export const metadata: Metadata = {
  title: "Avatar Gallery | The Humor Project",
  description: "Share avatars, discover favorites, and vote for the photos you love.",
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
            {children}
            <footer className="app-footer"><Link href="/">THE HUMOR PROJECT <span>© 2026</span></Link><span>A LITTLE PERSONALITY. A LOT OF POSSIBILITIES.</span><Link href={viewer ? "/profile" : "/login"}>MADE FOR YOU ↗</Link></footer>
          </div>
        </div>
        {session && !viewer && <Onboarding firstName={profile?.first_name ?? ""} lastName={profile?.last_name ?? ""} stateCode={profile?.state_code ?? ""} />}
      </body>
    </html>
  );
}
