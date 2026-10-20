import { after } from "next/server";
import { getViewer } from "@/lib/auth/profile";
import { readGallery } from "@/lib/gallery";
import { cleanupGalleryStaging } from "@/lib/gallery-media";
import { QuestInvitation } from "../quest-invitation";
import { Gallery } from "../gallery";
import { isGallerySort } from "@/lib/gallery-types";
export const metadata = { title: "Checked Gallery | checked" };
export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const viewerPromise = getViewer(); after(cleanupGalleryStaging);
  const params = await searchParams;
  const sort = isGallerySort(params.sort) ? params.sort : "top";
  const initial = readGallery(sort).catch(() => undefined);
  const viewer = await viewerPromise;
  return <><Gallery initial={initial} initialSort={sort} userId={viewer?.user.id ?? null} />{viewer && <QuestInvitation userId={viewer.user.id} />}</>;
}
