import { GuestLanding } from "./guest-landing";
import { getViewer } from "@/lib/auth/profile";
import { ChecklyDashboard } from "./checkly-dashboard";

export default async function Home() {
  const viewer = await getViewer();
  return viewer ? <ChecklyDashboard userId={viewer.user.id} firstName={viewer.profile?.first_name ?? ""} /> : <GuestLanding />;
}
