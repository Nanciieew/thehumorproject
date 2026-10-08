import "server-only";
import { createAuthClient } from "./auth/server";
import { isUuid } from "./gallery-types";
import type { Work, WorksPage } from "./work-types";

type WorkRow = {
  id: string; source: Work["source"]; created_at: string; published_at: string | null;
  title: string; description: string; private_storage_path: string | null; public_storage_path: string | null;
};
const columns = "id,source,created_at,published_at,title,description,private_storage_path,public_storage_path";
async function withPhoto(row: WorkRow, auth: Awaited<ReturnType<typeof createAuthClient>>): Promise<Work> {
  const work = { work_id: row.id, source: row.source, created_at: row.created_at,
    photo_id: row.published_at ? row.id : null, title: row.title, description: row.description };
  if (row.source === "upload" && row.public_storage_path) {
    return { ...work, photo_url: auth.storage.from("gallery-photos").getPublicUrl(row.public_storage_path).data.publicUrl };
  }
  if (!row.private_storage_path) throw new Error("Couldn’t load your image. Please refresh and try again.");
  const signed = await auth.storage.from("generated-images").createSignedUrl(row.private_storage_path, 3600);
  if (signed.error) throw new Error("Couldn’t load your image. Please refresh and try again.");
  return { ...work, photo_url: signed.data.signedUrl };
}
export async function readWorks(cursor: string | null = null): Promise<WorksPage> {
  const auth = await createAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) throw new Error("Please log in to view your works.");
  let query = auth.from("images").select(columns).eq("contributor_id", user.id)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(31);
  if (cursor) {
    try {
      if (cursor.length > 1024) throw new Error();
      const value = JSON.parse(Buffer.from(cursor, "base64url").toString());
      if (!isUuid(value.id) || typeof value.time !== "string" || !/^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/.test(value.time) || !Number.isFinite(Date.parse(value.time))) throw new Error();
      query = query.or(`created_at.lt.${value.time},and(created_at.eq.${value.time},id.lt.${value.id})`);
    } catch { throw new Error("Invalid works cursor. Please refresh the page."); }
  }
  const { data, error } = await query;
  if (error) throw new Error("Couldn’t load your works. Please try again.");
  const rows = data.slice(0, 30) as WorkRow[];
  const last = rows.at(-1);
  return { items: await Promise.all(rows.map((row) => withPhoto(row, auth))),
    next_cursor: data.length > 30 && last ? Buffer.from(JSON.stringify({ id: last.id, time: last.created_at })).toString("base64url") : null,
  };
}
export async function readWork(id: string): Promise<Work | null> {
  if (!isUuid(id)) return null;
  const auth = await createAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;
  const { data, error } = await auth.from("images").select(columns).eq("contributor_id", user.id).eq("id", id).maybeSingle();
  if (error) throw new Error("Couldn’t load this work. Please try again.");
  return data ? withPhoto(data as WorkRow, auth) : null;
}
