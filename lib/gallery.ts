import "server-only";
import { createAuthClient } from "@/lib/auth/server";
import { profilePhotoUrls } from "./profile-photo";
import { getAuthUser } from "./auth/profile";
import { supabase } from "@/lib/supabase";
import type { GalleryPage, GalleryPhoto, GallerySort, Vote } from "./gallery-types";

export class GalleryCursorExpired extends Error {}

export async function readGallery(sort: GallerySort, cursor: string | null = null): Promise<GalleryPage> {
  let decoded = null;
  if (cursor) {
    if (cursor.length > 2048) throw new Error("Invalid gallery cursor.");
    try { decoded = JSON.parse(Buffer.from(cursor, "base64url").toString()); }
    catch { throw new Error("Invalid gallery cursor."); }
    if (decoded?.created_at && !decoded?.published_at) throw new GalleryCursorExpired("Gallery ordering changed. Refreshing photos.");
    if (sort === "month" && decoded?.sort === "newest") throw new GalleryCursorExpired("Monthly ranking changed. Refreshing photos.");
  }
  const auth = await createAuthClient();
  const [{ data, error }, user] = await Promise.all([
    auth.rpc("gallery_feed", { p_sort: sort === "month" ? "top" : sort, p_cursor: decoded, p_limit: 30 }),
    getAuthUser(),
  ]);
  if (error) throw new Error("Couldn’t load the gallery. Please try again.");
  let items = data.items as (Omit<GalleryPhoto, "photo_url" | "vote"> & { storage_path: string })[];
  if (sort === "month") {
    const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit" });
    const currentMonth = month.format(new Date());
    const current = items.filter(item => month.format(new Date(item.published_at)) === currentMonth);
    items = current;
  }
  const ids = items.map(item => item.id);
  const votes = new Map<string, Vote>();
  const resultMetadata = new Map<string, { battle_votes: number; outcome: string; roast: string }>();
  const authorPhotos = new Map<string, string | null>();
  // Votes, battle metadata and author lookup depend on the feed, not each other.
  await Promise.all([ (async () => {
    if (!user || !ids.length) return;
    const own = await auth.from("photo_votes").select("photo_id,value").in("photo_id", ids).eq("voter_id", user.id);
    if (own.error) throw new Error("Couldn’t load your votes. Please try again.");
    for (const vote of own.data) votes.set(vote.photo_id, vote.value as Vote);
  })(), (async () => {
    if (!ids.length) return;
    const meta = await auth.rpc("ego_action", { p_action: "gallery_metadata", p_data: { ids } });
    if (meta.error && meta.error.code !== "PGRST202") throw new Error("Couldn’t load challenge result details.");
    for (const row of meta.data ?? []) resultMetadata.set(row.image_id, { battle_votes: Number(row.battle_votes), outcome: row.outcome, roast: row.roast });
  })(), (async () => {
  // Resolve only the public cards' authors; never return private profile fields.
  if (items.length) {
    const images = await supabase.from("images").select("id,contributor_id").in("id", items.map(item => item.id));
    if (images.error) throw new Error("Couldn’t load gallery authors.");
    const ids = [...new Set((images.data ?? []).map(image => image.contributor_id))];
    if (ids.length) {
      const profiles = await supabase.from("profiles").select("id,avatar_path").in("id", ids);
      if (profiles.error) throw new Error("Couldn’t load gallery authors.");
      const signed = await profilePhotoUrls((profiles.data ?? []).map(profile => profile.avatar_path));
      const urls = new Map((profiles.data ?? []).map(profile => [profile.id, signed.get(profile.avatar_path) ?? null]));
      for (const image of images.data ?? []) authorPhotos.set(image.id, urls.get(image.contributor_id) ?? null);
    }
  }
  })() ]);
  return {
    items: items.map(({ storage_path, ...item }) => ({ ...item, contributor_photo_url: authorPhotos.get(item.id) ?? null, kind: resultMetadata.has(item.id) || /(?:^|\/)roast-[^/]+\.webp$/.test(storage_path) ? "ego" as const : "memes" as const, result: resultMetadata.get(item.id), upvotes: Number(item.upvotes), vote: votes.get(item.id) ?? null,
      photo_url: supabase.storage.from("gallery-photos").getPublicUrl(storage_path).data.publicUrl,
    })),
    next_cursor: data.next_cursor ? Buffer.from(JSON.stringify(data.next_cursor)).toString("base64url") : null,
  };
}
