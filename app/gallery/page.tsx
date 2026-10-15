import { after } from "next/server";
import { getViewer } from "@/lib/auth/profile";
import { readGallery } from "@/lib/gallery";
import { cleanupGalleryStaging } from "@/lib/gallery-media";
import { Gallery } from "../gallery";
import { isGallerySort } from "@/lib/gallery-types";
export const metadata = { title: "Public Evidence | Ego Check" };
export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const viewer = await getViewer(); after(cleanupGalleryStaging);
  const params = await searchParams;
  const sort = isGallerySort(params.sort) ? params.sort : "top";
  const initial = await readGallery(sort).catch(() => undefined);
  return <Gallery initial={initial} initialSort={sort} userId={viewer?.user.id ?? null} />;
}
