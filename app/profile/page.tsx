import { PlayfulTitle } from "../playful-title";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getViewer } from "@/lib/auth/profile";
import { profilePhotoUrl } from "@/lib/profile-photo";
import { ProfileEditor } from "./profile-editor";
import { Smile } from "../ui";

export default async function ProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const profile = viewer.profile;
  const photoUrl = await profilePhotoUrl(profile?.avatar_path ?? null);
  return <main id="main">
    <header className="page-hero profile-hero"><div><p className="eyebrow"><span aria-hidden="true">✳</span> THE USUAL SUSPECT</p><PlayfulTitle text="My Profile" /><p>The usual suspect.<br />At least get your own name right.</p></div><Smile className="profile-illustration" /></header>
    <div className="profile-layout"><section className="profile-form-panel"><p className="eyebrow">A LITTLE ABOUT YOU</p><h2>THE PERSON RESPONSIBLE.</h2><ProfileEditor stateCode={profile?.state_code ?? ""} firstName={profile?.first_name ?? ""} lastName={profile?.last_name ?? ""} photoUrl={photoUrl} /></section>
      <aside className="profile-note"><span aria-hidden="true">✳</span><h3>THE EVIDENCE.<br />THE SUSPECT.<br />SAME PERSON.</h3><p>A face only your profile could explain.</p><Link href="/gallery" className="text-button">Inspect the evidence ↗</Link></aside>
    </div>
  </main>;
}
