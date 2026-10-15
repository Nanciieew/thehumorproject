import { after } from "next/server";
import { getViewer } from "@/lib/auth/profile";
import { readGallery } from "@/lib/gallery";
import { cleanupGalleryStaging } from "@/lib/gallery-media";
import { Gallery } from "../gallery";
export const metadata = { title: "Public Evidence | Ego Check" };
export default async function GalleryPage() {
  const viewer = await getViewer(); after(cleanupGalleryStaging);
  const initial = await readGallery("top").catch(() => undefined);
  return <Gallery initial={initial} userId={viewer?.user.id ?? null} />;
}
