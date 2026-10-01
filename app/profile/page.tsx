import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { profilePhotoUrl } from "@/lib/profile-photo";
import { logout } from "@/app/auth/actions";
import { ProfileEditor } from "./profile-editor";

export default async function ProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const photoUrl = await profilePhotoUrl(viewer.profile?.avatar_path ?? null);
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <nav aria-label="Account" className="flex items-center justify-end gap-4 text-sm">
        <form action={logout}><button className="rounded-full border border-current/25 px-4 py-2 hover:bg-foreground/5">Log out</button></form>
      </nav>
      <section className="mt-8 rounded-2xl border border-current/15 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-60">Your account</p>
        <h1 className="mt-3 text-3xl font-bold">Profile</h1>
        <p className="mt-3 opacity-70">Make yourself at home. Update your name and add a photo.</p>
        <ProfileEditor firstName={viewer.profile?.first_name ?? ""} lastName={viewer.profile?.last_name ?? ""} photoUrl={photoUrl} />
      </section>
    </main>
  );
}
