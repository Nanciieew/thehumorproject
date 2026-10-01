"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/auth/server";
import { readProfile, hasCompleteName } from "@/lib/auth/profile";
import { supabase } from "@/lib/supabase";

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

export async function completeProfile(_state: FormState, form: FormData): Promise<FormState> {
  const auth = await createAuthClient();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) redirect("/login");

  try {
    let profile = await readProfile(user.id);
    if (hasCompleteName(profile)) {
      // A stale form must never replace an already completed profile.
    } else {
      const updates: { field: "first_name" | "last_name"; value: string; previous: string | null }[] = [];
      for (const field of ["first_name", "last_name"] as const) {
        const previous = profile?.[field] ?? null;
        if (previous?.trim()) continue;
        const input = form.get(field);
        const value = typeof input === "string" ? input.trim() : "";
        if (!value || value.length > 100) return { error: "Enter both names, using 1–100 characters for each." };
        updates.push({ field, value, previous });
      }
      // The SQL trigger normally creates this row. Also support older accounts.
      if (!profile) {
        const { error } = await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
        if (error) throw error;
        profile = await readProfile(user.id);
      }
      for (const { field, value } of updates) {
        const previous = profile?.[field] ?? null;
        if (previous?.trim()) continue;
        const query = supabase.from("profiles").update({ [field]: value }).eq("id", user.id);
        const { error } = await (previous === null ? query.is(field, null) : query.eq(field, previous));
        if (error) throw error;
      }
      if (!hasCompleteName(await readProfile(user.id))) throw new Error("Incomplete profile");
    }
  } catch {
    return { error: "We couldn’t save your names. Please try again." };
  }
  revalidatePath("/", "layout");
  redirect("/");
}
