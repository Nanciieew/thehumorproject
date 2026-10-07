import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";

export default async function CompleteProfilePage() {
  const viewer = await getViewer();
  redirect(viewer ? "/" : "/login");
}
