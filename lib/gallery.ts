import "server-only";
import { createAuthClient } from "@/lib/auth/server";
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
  }
  const auth = await createAuthClient();
  const { data, error } = await auth.rpc("gallery_feed", { p_sort: sort === "month" ? "newest" : sort, p_cursor: decoded, p_limit: 30 });
  if (error) throw new Error("Couldn’t load the gallery. Please try again.");
  let items = data.items as (Omit<GalleryPhoto, "photo_url" | "vote"> & { storage_path: string })[];
  if (sort === "month") {
    const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit" });
    const currentMonth = month.format(new Date());
    const current = items.filter(item => month.format(new Date(item.published_at)) === currentMonth);
    if (current.length !== items.length) data.next_cursor = null;
    items = current;
  }
  const { data: { user } } = await auth.auth.getUser();
  const votes = new Map<string, Vote>();
  if (user && items.length) {
    const own = await auth.from("photo_votes").select("photo_id,value").in("photo_id", items.map((item) => item.id)).eq("voter_id", user.id);
    if (own.error) throw new Error("Couldn’t load your votes. Please try again.");
    for (const vote of own.data) votes.set(vote.photo_id, vote.value as Vote);
  }
  return {
    items: items.map(({ storage_path, ...item }) => ({ ...item, upvotes: Number(item.upvotes), vote: votes.get(item.id) ?? null,
      photo_url: supabase.storage.from("gallery-photos").getPublicUrl(storage_path).data.publicUrl,
    })),
    next_cursor: data.next_cursor ? Buffer.from(JSON.stringify(data.next_cursor)).toString("base64url") : null,
  };
}
