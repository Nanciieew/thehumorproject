import "server-only";
import { createAuthClient } from "@/lib/auth/server";
import { supabase } from "@/lib/supabase";
import type { GalleryPage, GalleryPhoto, GallerySort, Vote } from "./gallery-types";

export async function readGallery(sort: GallerySort, cursor: string | null = null): Promise<GalleryPage> {
  let decoded = null;
  if (cursor) {
    if (cursor.length > 2048) throw new Error("Invalid gallery cursor.");
    try { decoded = JSON.parse(Buffer.from(cursor, "base64url").toString()); }
    catch { throw new Error("Invalid gallery cursor."); }
  }
  const auth = await createAuthClient();
  const { data, error } = await auth.rpc("gallery_feed", { p_sort: sort, p_cursor: decoded, p_limit: 30 });
  if (error) throw new Error("Couldn’t load the gallery. Please try again.");
  const items = data.items as (Omit<GalleryPhoto, "photo_url" | "vote"> & { storage_path: string })[];
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
