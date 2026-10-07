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
    <header className="page-hero profile-hero"><div><p className="eyebrow"><span aria-hidden="true">✳</span> YOUR LITTLE CORNER</p><h1>HELLO, {profile?.first_name || "THERE"}.<br /><em>MAKE IT YOURS.</em></h1><p>The face, the name, the personality.<br />A little introduction goes a long way.</p></div><Smile className="profile-illustration" /></header>
    <div className="profile-layout"><section className="profile-form-panel"><p className="eyebrow">A LITTLE ABOUT YOU</p><h2>THE PERSON BEHIND THE FACE.</h2><ProfileEditor stateCode={profile?.state_code ?? ""} firstName={profile?.first_name ?? ""} lastName={profile?.last_name ?? ""} photoUrl={photoUrl} /></section>
      <aside className="profile-note"><span aria-hidden="true">✳</span><h3>NO TWO FACES.<br />NO TWO STORIES.<br />JUST BE YOU.</h3><p>We like a little different.<br />That’s kind of the whole point.</p><Link href="/" className="text-button">Meet the community ↗</Link></aside>
    </div>
  </main>;
}
