import "server-only";
import { cache } from "react";
import { createAuthClient } from "@/lib/auth/server";
import { supabase } from "@/lib/supabase";

export type Profile = { id: string; first_name: string | null; last_name: string | null; avatar_path: string | null; state_code: string | null; onboarding_completed_at: string | null };

export async function readProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles")
    .select("id, first_name, last_name, avatar_path, state_code, onboarding_completed_at").eq("id", userId).maybeSingle();
  if (error) throw new Error("Unable to load your profile. Please try again.");
  return data;
}

// A verified OAuth session may still be waiting for signup to finish.
export const getAuthViewer = cache(async () => {
  const auth = await createAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;
  return { user, profile: await readProfile(user.id) };
});

export const getViewer = cache(async () => {
  const viewer = await getAuthViewer();
  return viewer?.profile?.onboarding_completed_at ? viewer : null;
});
