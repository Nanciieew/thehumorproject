import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/auth/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  if (!params.has("error") && code) {
    const auth = await createAuthClient();
    const { error } = await auth.auth.exchangeCodeForSession(code);
    if (!error) redirect("/profile/complete");
  }
  redirect("/login?error=oauth");
}
