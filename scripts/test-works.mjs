// Apply the My Works migration, start the app locally, then run:
// node --env-file=.env.local scripts/test-works.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import sharp from "sharp";

const base = "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const users = []; const objects = [];
const check = (result) => { assert.ifError(result.error); return result.data; };
async function user(complete = true) {
  const email = `works-test-${randomUUID()}@example.com`; const password = randomUUID() + randomUUID();
  const { user } = check(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  const jar = new Map(); const actor = { id: user.id }; users.push(actor);
  actor.client = createServerClient(url, process.env.SUPABASE_PUBLISHABLE_KEY, { cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (values) => values.forEach(({ name, value }) => jar.set(name, value)),
  } });
  check(await actor.client.auth.signInWithPassword({ email, password }));
  actor.cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  check(await admin.from("profiles").insert({ id: actor.id, first_name: "Works", last_name: "Tester", state_code: "NY", onboarding_completed_at: complete ? new Date().toISOString() : null }));
  return actor;
}
async function request(path, actor, body) {
  return fetch(base + path, { method: body ? "PATCH" : "GET", redirect: "manual", headers: { origin: base, "Content-Type": "application/json", ...(actor ? { cookie: actor.cookie() } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function page(actor, cursor) {
  const response = await request(`/api/my-works${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, actor);
  assert.equal(response.status, 200, await response.clone().text()); return response.json();
}
try {
  // Fail before creating fixtures if migration/credentials are not ready.
  check(await admin.from("work_captions").select("work_id").limit(1));
  const a = await user(); const b = await user(); const pending = await user(false);
  const uploads = Array.from({ length: 32 }, () => ({ id: randomUUID(), contributor_id: a.id, storage_path: `${a.id}/${randomUUID()}.webp`, source: "upload" }));
  check(await admin.from("gallery_photos").insert(uploads));
  const generation = randomUUID(); const storagePath = `${a.id}/${generation}.webp`;
  const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } }).webp().toBuffer();
  check(await admin.storage.from("generated-images").upload(storagePath, bytes, { contentType: "image/webp" })); objects.push(storagePath);
  check(await admin.from("generated_images").insert({ id: generation, contributor_id: a.id, storage_path: storagePath }));
  const first = await page(a); const second = await page(a, first.next_cursor);
  const all = [...first.items, ...second.items];
  assert.equal(first.items.length, 30); assert.equal(second.next_cursor, null);
  assert.equal(new Set(all.map((work) => work.work_id)).size, 33);
  assert.equal(all.find((work) => work.work_id === generation).photo_id, null);
  assert.equal((await page(b)).items.length, 0);
  assert.equal((await request("/api/my-works")).status, 401);
  assert.equal((await request("/api/my-works", pending)).status, 401);
  assert.equal((await request("/api/my-works?cursor=garbage", a)).status, 400);
  assert.ok([303, 307].includes((await request("/my-works")).status));
  console.log("PASS: owner-only collection, guest/pending restrictions and unique cursor pagination.");

  const captions = { title: "  A new name  ", description: "The story behind it" };
  assert.equal((await request(`/api/my-works/${generation}`, b, captions)).status, 404);
  assert.equal((await request(`/api/my-works/${generation}`, pending, captions)).status, 401);
  assert.equal((await request(`/api/my-works/${generation}`, a, { ...captions, title: "x".repeat(101) })).status, 400);
  const saved = await request(`/api/my-works/${generation}`, a, captions);
  assert.equal(saved.status, 200, await saved.clone().text()); assert.equal((await saved.json()).title, "A new name");
  assert.equal(check(await a.client.from("my_works").select("title").eq("work_id", generation).single()).title, "A new name");
  assert.ok((await anon.from("work_captions").select("*")).error);
  assert.deepEqual(check(await b.client.from("work_captions").select("*")), []);
  assert.ok((await b.client.rpc("save_work_caption", { p_work_id: generation, p_title: "Stolen", p_description: "" })).error);
  assert.ok((await a.client.from("work_captions").update({ contributor_id: b.id }).eq("work_id", generation)).error);
  const pendingWork = randomUUID();
  check(await admin.from("generated_images").insert({ id: pendingWork, contributor_id: pending.id, storage_path: `${pending.id}/${pendingWork}.webp` }));
  assert.ok((await pending.client.rpc("save_work_caption", { p_work_id: pendingWork, p_title: "Too early", p_description: "" })).error);
  assert.ok(!JSON.stringify(check(await anon.rpc("gallery_feed", { p_sort: "newest", p_limit: 60 }))).includes("A new name"));
  const publicId = randomUUID();
  check(await admin.from("gallery_photos").insert({ id: publicId, contributor_id: a.id, storage_path: storagePath, source: "generated", generation_id: generation }));
  const published = [...(await page(a)).items, ...(await page(a, (await page(a)).next_cursor)).items];
  assert.equal(published.filter((work) => work.work_id === generation).length, 1);
  const feed = check(await anon.rpc("gallery_feed", { p_sort: "newest", p_limit: 60 }));
  assert.equal(feed.items.find((photo) => photo.id === publicId).title, "A new name");
  assert.equal((await request(`/my-works/${generation}`, b)).status, 404);
  assert.equal((await request(`/api/my-works/${generation}`, a, { title: "", description: "" })).status, 200);
  assert.equal(check(await a.client.from("my_works").select("title").eq("work_id", generation).single()).title, "");
  console.log("PASS: persistent captions, validation, clearing, RLS isolation and published/private behavior without duplicate works.");
} finally {
  if (objects.length) check(await admin.storage.from("generated-images").remove(objects));
  for (const actor of users) {
    check(await admin.from("gallery_photos").delete().eq("contributor_id", actor.id));
    check(await admin.from("generated_images").delete().eq("contributor_id", actor.id));
    check(await admin.auth.admin.deleteUser(actor.id));
  }
}
