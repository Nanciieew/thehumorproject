import "server-only";
import { createAuthClient } from "./auth/server";
import { isUuid } from "./gallery-types";
import type { Work, WorksPage } from "./work-types";

type WorkRow = Omit<Work, "photo_url"> & { storage_path: string; bucket: string };
async function withPhoto(row: WorkRow, auth: Awaited<ReturnType<typeof createAuthClient>>): Promise<Work> {
  const { bucket, storage_path, ...work } = row;
  if (bucket === "gallery-photos") return { ...work, photo_url: auth.storage.from(bucket).getPublicUrl(storage_path).data.publicUrl };
  const signed = await auth.storage.from("generated-images").createSignedUrl(storage_path, 3600);
  if (signed.error) throw new Error("Couldn’t load your image. Please refresh and try again.");
  return { ...work, photo_url: signed.data.signedUrl };
}
export async function readWorks(cursor: string | null = null): Promise<WorksPage> {
  const auth = await createAuthClient();
  let query = auth.from("my_works").select("work_id,source,created_at,photo_id,title,description,storage_path,bucket")
    .order("created_at", { ascending: false }).order("work_id", { ascending: false }).limit(31);
  if (cursor) {
    try {
      if (cursor.length > 1024) throw new Error();
      const value = JSON.parse(Buffer.from(cursor, "base64url").toString());
      if (!isUuid(value.id) || typeof value.time !== "string" || !/^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/.test(value.time) || !Number.isFinite(Date.parse(value.time))) throw new Error();
      query = query.or(`created_at.lt.${value.time},and(created_at.eq.${value.time},work_id.lt.${value.id})`);
    } catch { throw new Error("Invalid works cursor. Please refresh the page."); }
  }
  const { data, error } = await query;
  if (error) throw new Error("Couldn’t load your works. Please try again.");
  const rows = data.slice(0, 30) as WorkRow[];
  const last = rows.at(-1);
  return { items: await Promise.all(rows.map((row) => withPhoto(row, auth))),
    next_cursor: data.length > 30 && last ? Buffer.from(JSON.stringify({ id: last.work_id, time: last.created_at })).toString("base64url") : null,
  };
}
export async function readWork(id: string): Promise<Work | null> {
  if (!isUuid(id)) return null;
  const auth = await createAuthClient();
  const { data, error } = await auth.from("my_works").select("work_id,source,created_at,photo_id,title,description,storage_path,bucket").eq("work_id", id).maybeSingle();
  if (error) throw new Error("Couldn’t load this work. Please try again.");
  return data ? withPhoto(data as WorkRow, auth) : null;
}
