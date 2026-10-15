import "server-only";
import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/supabase";
async function command(user: string, session: string, token: string, mode: string, roast: string | null = null) {
  const r = await supabase.rpc("ego_roast_lock", { p_user: user, p_session: session, p_token: token, p_mode: mode, p_roast: roast });
  if (r.error) throw new Error("Shared roast storage is unavailable. Install the Ego Check database migration.");
  return r.data;
}
export async function resetSharedSession(user: string, id: string) { await command(user, id, randomUUID(), "reset"); }
export async function acquireSharedSession(user: string, id: string) {
  const token = randomUUID();
  const result = await command(user, id, token, "acquire");
  if (!result) return null;
  return { jokes: result.jokes as string[], finish: async (roast: string | null) => !!(await command(user, id, token, "finish", roast))?.current };
}
