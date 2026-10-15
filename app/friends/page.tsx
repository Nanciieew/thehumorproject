import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { FriendsView } from "./view";
export const metadata = { title: "Friends | Ego Check" };
export default async function FriendsPage() { if(!await getViewer())redirect("/login?next=/friends");return <FriendsView/>; }
