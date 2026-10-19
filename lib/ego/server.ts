import "server-only";
import { createAuthClient } from "@/lib/auth/server";
import { supabase } from "@/lib/supabase";
export class EgoError extends Error {}
export async function egoRead<T>(action: string, data: object = {}): Promise<T> {
  const auth = await createAuthClient();
  const result = await auth.rpc("ego_action", { p_action: action, p_data: data });
  if (result.error) throw new EgoError(result.error.code === "42501" ? "This challenge or action is not available to your account." : result.error.code === "PGRST202" ? "checked’s database update is not installed yet." : "This action couldn’t be completed. Refresh and try again.");
  return result.data as T;
}
export async function egoServer<T>(user: string | null, action: string, data: object): Promise<T> {
  const result = await supabase.rpc("ego_server_action", { p_user: user, p_action: action, p_data: data });
  if (result.error) throw new EgoError("This result is unavailable or no longer accepts changes.");
  return result.data as T;
}
export const noStore = { "Cache-Control": "private, no-store" };
