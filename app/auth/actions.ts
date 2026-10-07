"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/auth/server";

export type FormState = { error?: string };

export async function loginWithGoogle(): Promise<FormState> {
  const origin = (await headers()).get("origin");
  if (!origin) return { error: "Please refresh the page and try again." };
  const auth = await createAuthClient();
  const { data, error } = await auth.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: new URL("/auth/callback", origin).toString(), skipBrowserRedirect: true },
  });
  if (error || !data.url) return { error: "Google login is unavailable. Please try again." };
  redirect(data.url);
}

export async function logout() {
  const auth = await createAuthClient();
  const { error } = await auth.auth.signOut({ scope: "local" });
  if (error) redirect("/login?error=logout");
  revalidatePath("/", "layout");
  redirect("/");
}
