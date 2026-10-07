import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "./sidebar";
import { getViewer } from "@/lib/auth/profile";
import { profilePhotoUrl } from "@/lib/profile-photo";
import { AccountMenu } from "./account-menu";
import { Onboarding } from "./onboarding";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jokes | The Humor Project",
  description: "Browse photo jokes, funny questions, and their punchlines.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewer();
  const profile = viewer?.profile;
  const photoUrl = await profilePhotoUrl(profile?.avatar_path ?? null);
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className={viewer ? "min-h-dvh md:grid md:grid-cols-[240px_minmax(0,1fr)]" : "min-h-dvh"}>
          {viewer && <Sidebar />}
          <div className="min-w-0">
            <AccountMenu signedIn={Boolean(viewer)} name={[profile?.first_name, profile?.last_name].filter(Boolean).join(" ")} initials={`${profile?.first_name?.slice(0, 1) ?? ""}${profile?.last_name?.slice(0, 1) ?? ""}`} photoUrl={photoUrl} />
            {children}
          </div>
        </div>
        {viewer && !profile?.onboarding_completed_at && <Onboarding firstName={profile?.first_name ?? ""} lastName={profile?.last_name ?? ""} stateCode={profile?.state_code ?? ""} />}
      </body>
    </html>
  );
}
