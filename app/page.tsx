import { redirect } from "next/navigation";
import { GuestLanding } from "./guest-landing";
import { getViewer } from "@/lib/auth/profile";

export default async function Home() {
  if (await getViewer()) redirect("/my-works");
  return <GuestLanding />;
}
