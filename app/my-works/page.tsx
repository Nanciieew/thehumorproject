import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { readWorks } from "@/lib/works";
import { MyCheckboard } from "./checkboard";

export const metadata = { title: "My Checkboard | checked" };
export default async function MyDashboardPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/my-works");
  const works = await readWorks();
  return <MyCheckboard key={JSON.stringify(works)} userId={viewer.user.id} initial={works} />;
}
