import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthViewer } from "@/lib/auth/profile";
import { GoogleLoginForm } from "./google-login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const viewer = await getAuthViewer();
  if (viewer && !error) redirect("/");
  return (
    <main className="mx-auto w-full max-w-md px-6 py-16 sm:py-24">
      <Link href="/" className="text-sm opacity-70 hover:underline">← Back to jokes</Link>
      <section className="mt-8 rounded-2xl border border-current/15 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-60">The Humor Project</p>
        <h1 className="mt-3 text-3xl font-bold">A little more you.</h1>
        <p className="mt-3 leading-relaxed opacity-70">Log in or join with your Google account. No new password to remember.</p>
        {error && <p role="alert" className="mt-5 text-sm text-red-600 dark:text-red-400">{error === "logout" ? "We couldn’t log you out. Please try again." : "Google sign-in wasn’t completed. Please try again."}</p>}
        <GoogleLoginForm />
      </section>
    </main>
  );
}
