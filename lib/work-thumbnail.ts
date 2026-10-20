import "server-only";
import sharp from "sharp";
import { supabase } from "./supabase";
import { isUuid } from "./gallery-types";

export const THUMBNAIL_WIDTHS = [320, 640, 960] as const;

// userId comes only from the verified session in the route handler.
export async function workThumbnail(userId: string | null, id: string, width: number): Promise<Response> {
  const fail = (status: number) => new Response(null, { status, headers: { "Cache-Control": "private, no-store" } });
  if (!userId) return fail(401);
  if (!isUuid(id)) return fail(404);
  if (!(THUMBNAIL_WIDTHS as readonly number[]).includes(width)) return fail(400);
  const { data: row, error } = await supabase.from("images").select("private_storage_path")
    .eq("contributor_id", userId).eq("id", id).maybeSingle();
  if (error) return fail(503);
  if (!row?.private_storage_path?.startsWith(`${userId}/`)) return fail(404);
  const file = await supabase.storage.from("generated-images").download(row.private_storage_path);
  if (file.error) return fail(503);
  try {
    const bytes = await sharp(Buffer.from(await file.data.arrayBuffer()), { limitInputPixels: 24_000_000 })
      .rotate().resize(width, width, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "image/webp", "Cache-Control": "private, max-age=300", Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch { return fail(503); }
}
