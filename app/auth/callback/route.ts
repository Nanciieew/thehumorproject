import { cookies } from "next/headers";
import { readProfile } from "@/lib/auth/profile";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/auth/server";
import { adminReturnPath } from "@/lib/auth/return-path";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  if (!params.has("error") && code) {
    const auth = await createAuthClient();
    const { error } = await auth.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await auth.auth.getUser();
      const profile = user ? await readProfile(user.id) : null;
      if (profile?.onboarding_completed_at) {
        const jar = await cookies();
        const destination = adminReturnPath(jar.get("ego_return")?.value);
        jar.delete("ego_return");
        redirect(destination ?? "/gallery?welcome=quest");
      }
      redirect("/profile/complete");
    }
  }
  redirect("/login?error=oauth");
}
