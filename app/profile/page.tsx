import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { profilePhotoUrl } from "@/lib/profile-photo";
import { ProfileEditor } from "./profile-editor";

export default async function ProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const photoUrl = await profilePhotoUrl(viewer.profile?.avatar_path ?? null);
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <section className="mt-8 rounded-2xl border border-current/15 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-60">Your account</p>
        <h1 className="mt-3 text-3xl font-bold">Profile Settings</h1>
        <p className="mt-3 opacity-70">Make yourself at home. Update your name, photo, and the state you represent.</p>
        <ProfileEditor stateCode={viewer.profile?.state_code ?? ""} firstName={viewer.profile?.first_name ?? ""} lastName={viewer.profile?.last_name ?? ""} photoUrl={photoUrl} />
      </section>
    </main>
  );
}
