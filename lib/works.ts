import "server-only";
import { supabase } from "./supabase";
import { readReceivedVotes } from "./checkboard";
import { createAuthClient } from "./auth/server";
import { isUuid } from "./gallery-types";
import type { Work, WorksPage, WorksSort } from "./work-types";

type WorkRow = {
  id: string; source: Work["source"]; created_at: string; published_at: string | null;
  title: string; description: string; private_storage_path: string | null; public_storage_path: string | null;
};
const columns = "id,source,created_at,published_at,title,description,private_storage_path,public_storage_path";
async function withPhoto(row: WorkRow, auth: Awaited<ReturnType<typeof createAuthClient>>): Promise<Work> {
  const work = { work_id: row.id, source: row.source, created_at: row.created_at, published_at: row.published_at,
    photo_id: row.published_at ? row.id : null, title: row.title, description: row.description };
  if (row.source === "upload" && row.public_storage_path) {
    return { ...work, photo_url: auth.storage.from("gallery-photos").getPublicUrl(row.public_storage_path).data.publicUrl };
  }
  if (!row.private_storage_path) throw new Error("Couldn’t load your image. Please refresh and try again.");
  const signed = await auth.storage.from("generated-images").createSignedUrl(row.private_storage_path, 3600);
  if (signed.error) throw new Error("Couldn’t load your image. Please refresh and try again.");
  return { ...work, photo_url: signed.data.signedUrl };
}
function compareWorks(a: { id: string; time: string; upvotes: string }, b: { id: string; time: string; upvotes: string }, sort: WorksSort) {
  const score = sort === "top" ? BigInt(b.upvotes) - BigInt(a.upvotes) : BigInt(0);
  return score < 0 ? -1 : score > 0 ? 1 : Date.parse(b.time) - Date.parse(a.time) || b.id.localeCompare(a.id);
}
export async function readWorks(cursor: string | null = null, sort: WorksSort = "top"): Promise<WorksPage> {
  const auth = await createAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) throw new Error("Please log in to view your works.");
  return readOwnedWorks(user.id, cursor, sort);
}

// Read the entire owner's score index before paging so top-voted memes on later
// upload pages can rise to the first page. Only sign URLs for the requested page.
export async function readOwnedWorks(userId: string, cursor: string | null = null, sort: WorksSort = "top"): Promise<WorksPage> {
  let after: { id: string; time: string; upvotes: string } | null = null;
  if (cursor) {
    try {
      if (cursor.length > 1024) throw new Error();
      const value = JSON.parse(Buffer.from(cursor, "base64url").toString());
      if (value.sort !== sort || !isUuid(value.id) || typeof value.time !== "string" || !Number.isFinite(Date.parse(value.time)) || typeof value.upvotes !== "string" || !/^\d{1,40}$/.test(value.upvotes)) throw new Error();
      after = value;
    } catch { throw new Error("Invalid works cursor. Please refresh the page."); }
  }
  const rows: WorkRow[] = [];
  let lastId: string | null = null;
  while (true) {
    let query = supabase.from("images").select(columns).eq("contributor_id", userId).order("id").limit(250);
    if (lastId) query = query.gt("id", lastId);
    const { data, error } = await query;
    if (error) throw new Error("Couldn’t load your works. Please try again.");
    rows.push(...data as WorkRow[]);
    if (data.length < 250) break;
    lastId = data[data.length - 1].id;
  }
  const votes: Awaited<ReturnType<typeof readReceivedVotes>> = {};
  const ids = rows.filter(row => row.published_at).map(row => row.id);
  for (let index = 0; index < ids.length; index += 250) Object.assign(votes, await readReceivedVotes(ids.slice(index, index + 250)));
  let upvotes = BigInt(0), downvotes = BigInt(0);
  const ranked = rows.map(row => {
    const totals = votes[row.id] ?? { upvotes: "0", downvotes: "0" };
    upvotes += BigInt(totals.upvotes); downvotes += BigInt(totals.downvotes);
    return { row, id: row.id, time: row.published_at ?? row.created_at, ...totals };
  }).sort((a, b) => compareWorks(a, b, sort));
  const remaining = after ? ranked.filter(row => compareWorks(row, after!, sort) > 0) : ranked;
  const page = remaining.slice(0, 30), last = page.at(-1);
  return {
    items: await Promise.all(page.map(async item => ({ ...await withPhoto(item.row, supabase), upvotes: item.upvotes, downvotes: item.downvotes }))),
    next_cursor: remaining.length > 30 && last ? Buffer.from(JSON.stringify({ sort, id: last.id, time: last.time, upvotes: last.upvotes })).toString("base64url") : null,
    received: { upvotes: upvotes.toString(), downvotes: downvotes.toString() },
  };
}

export async function deleteWork(userId: string, id: string, confirmed: boolean) {
  if (!confirmed) throw new Error("Confirm deletion first.");
  if (!isUuid(id)) throw new Error("Work not found.");
  const owned = await supabase.from("images").select("private_storage_path,public_storage_path").eq("contributor_id", userId).eq("id", id).maybeSingle();
  if (owned.error) throw new Error("Couldn’t check this meme. Please try again.");
  if (!owned.data) return; // A retry after a successful deletion is safe.
  const removed = await supabase.from("images").delete().eq("contributor_id", userId).eq("id", id).select("id");
  if (removed.error) throw new Error("Couldn’t delete this meme. Please try again.");
  // Votes cascade from images. Remove media only after the row deletion succeeds.
  for (const [bucket, path] of [["gallery-photos", owned.data.public_storage_path], ["generated-images", owned.data.private_storage_path]] as const) {
    if (path?.startsWith(`${userId}/`)) {
      try { await supabase.storage.from(bucket).remove([path]); } catch { /* The deleted row is already inaccessible. */ }
    }
  }
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
