import "server-only";
import { cache } from "react";
import { createAuthClient } from "@/lib/auth/server";
import { supabase } from "@/lib/supabase";

export type Profile = { id: string; first_name: string | null; last_name: string | null };

export function hasCompleteName(profile: Profile | null) {
  return Boolean(profile?.first_name?.trim() && profile?.last_name?.trim());
}

export async function readProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles")
    .select("id, first_name, last_name").eq("id", userId).maybeSingle();
  if (error) throw new Error("Unable to load your profile. Please try again.");
  return data;
}

export const getViewer = cache(async () => {
  const auth = await createAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;
  return { user, profile: await readProfile(user.id) };
});
