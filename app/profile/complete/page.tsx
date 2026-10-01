import { redirect } from "next/navigation";
import { getViewer, hasCompleteName } from "@/lib/auth/profile";
import { logout } from "@/app/auth/actions";
import { ProfileForm } from "./profile-form";

export default async function CompleteProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (hasCompleteName(viewer.profile)) redirect("/");
  return (
    <main className="mx-auto w-full max-w-md px-6 py-16 sm:py-24">
      <section className="rounded-2xl border border-current/15 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-60">One last thing</p>
        <h1 className="mt-3 text-3xl font-bold">What should we call you?</h1>
        <p className="mt-3 leading-relaxed opacity-70">Add your missing name details to finish your profile.</p>
        <ProfileForm firstName={viewer.profile?.first_name ?? null} lastName={viewer.profile?.last_name ?? null} />
        <form action={logout} className="mt-6 text-center"><button className="text-sm opacity-70 hover:underline">Log out</button></form>
      </section>
    </main>
  );
}
