// Run against a local app: node --env-file=.env.local scripts/test-gallery.mjs
// Uses isolated temporary users, photos, and objects; always cleans them up.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import sharp from "sharp";

const base = "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const users = [];
const photos = [];
const check = (result) => { assert.ifError(result.error); return result.data; };
async function user(complete) {
  const email = `gallery-test-${randomUUID()}@example.com`; const password = randomUUID() + randomUUID();
  const created = check(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
  const record = { id: created.id }; users.push(record);
  const jar = new Map();
  record.client = createServerClient(url, process.env.SUPABASE_PUBLISHABLE_KEY, { cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (values) => values.forEach(({ name, value }) => jar.set(name, value)),
  } });
  check(await record.client.auth.signInWithPassword({ email, password }));
  record.cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  check(await admin.from("profiles").insert({ id: record.id, first_name: "Gallery", last_name: "Tester", state_code: "NY", onboarding_completed_at: complete ? new Date().toISOString() : null }));
  return record;
}
async function post(path, body, actor) {
  const response = await fetch(base + path, { method: "POST", headers: { origin: base, "Content-Type": "application/json", ...(actor ? { cookie: actor.cookie() } : {}) }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
async function successful(path, body, actor) {
  const result = await post(path, body, actor); assert.equal(result.status, 200, result.data.error); return result.data;
}
async function ticket(actor, size = 100, type = "image/png") { return successful("/api/gallery/upload", { size, type }, actor); }
async function put(ticket, bytes, type = "image/png") {
  const form = new FormData(); form.append("cacheControl", "600"); form.append("", new Blob([bytes], { type }), "test.png");
  return fetch(ticket.signedUrl, { method: "PUT", body: form });
}
async function score(id) { return check(await anon.rpc("gallery_photo_score", { p_photo_id: id }))[0].upvotes; }
async function vote(actor, id, value) { return successful("/api/gallery/vote", { photoId: id, value }, actor); }
async function fixture(actor, publishedAt, generated = false) {
  const id = randomUUID(); const path = `${actor.id}/${id}.webp`;
  if (generated) check(await admin.from("images").insert({ id, contributor_id: actor.id, source: "generated", private_storage_path: path }));
  else {
    check(await admin.from("images").insert({ id, contributor_id: actor.id, public_storage_path: path, source: "upload", created_at: publishedAt, published_at: publishedAt })); photos.push(id);
  }
  return { id, path };
}
try {
  const a = await user(true); const b = await user(true); const pending = await user(false);
  assert.equal((await post("/api/gallery/upload", {size: 100, type: "image/png"})).status, 401);
  assert.equal((await post("/api/gallery/upload", {size: 100, type: "image/png"}, pending)).status, 401);
  const photo = await fixture(a, new Date(Date.now() - 2000).toISOString());
  assert.equal((await post("/api/gallery/vote", {photoId: photo.id, value: 1})).status, 401);
  assert.equal((await post("/api/gallery/vote", {photoId: photo.id, value: 1}, pending)).status, 401);
  assert.ok((await anon.from("photo_votes").insert({photo_id: photo.id, voter_id: a.id, value: 1})).error);
  assert.ok((await pending.client.from("photo_votes").insert({photo_id: photo.id, voter_id: pending.id, value: 1})).error);
  assert.ok((await a.client.from("photo_votes").insert({photo_id: photo.id, voter_id: b.id, value: 1})).error);
  assert.ok((await a.client.from("photo_votes").insert({photo_id: photo.id, voter_id: a.id, value: 0})).error);
  assert.ok((await a.client.from("images").insert({contributor_id: b.id, public_storage_path: `${b.id}/spoof.webp`, source: "upload", published_at: new Date().toISOString()})).error);
  assert.ok((await anon.from("gallery_vote_totals").select("*")).error);
  assert.ok((await a.client.from("gallery_vote_totals").select("*")).error);
  console.log("PASS: guest and pending signup writes rejected; spoofed votes/contributors and invalid votes denied; admin totals private.");

  assert.equal((await vote(a, photo.id, 1)).upvotes, 1);
  assert.equal((await vote(a, photo.id, 1)).upvotes, 1);
  assert.equal((await vote(a, photo.id, -1)).upvotes, 0);
  let totals = check(await admin.from("gallery_vote_totals").select("*").eq("photo_id", photo.id).single());
  assert.equal(totals.downvotes, 1);
  assert.equal((await vote(a, photo.id, null)).upvotes, 0);
  await vote(a, photo.id, 1);
  assert.equal((await vote(a, photo.id, null)).upvotes, 0);
  await vote(a, photo.id, -1);
  assert.equal((await vote(a, photo.id, 1)).upvotes, 1);
  await Promise.all(Array.from({ length: 5 }, () => vote(b, photo.id, 1)));
  assert.equal(await score(photo.id), 2);
  assert.equal(check(await admin.from("photo_votes").select("*").eq("photo_id", photo.id)).length, 2);
  const owned = check(await a.client.from("photo_votes").select("*"));
  assert.ok(owned.every((row) => row.voter_id === a.id));
  assert.deepEqual(check(await b.client.from("photo_votes").update({value: -1}).eq("voter_id", a.id).select()), []);
  assert.deepEqual(check(await b.client.from("photo_votes").delete().eq("voter_id", a.id).select()), []);
  assert.ok((await a.client.from("photo_votes").update({voter_id: b.id}).eq("photo_id", photo.id)).error);
  assert.equal(await score(photo.id), 2);
  const apiPage = await (await fetch(base + "/api/gallery", {headers: {cookie: a.cookie()}})).json();
  const shown = apiPage.items.find((item) => item.id === photo.id);
  assert.equal(shown.vote, 1); assert.equal(shown.upvotes, 2); assert.equal(shown.contributor_name, "Gallery Tester");
  assert.equal(shown.downvotes, undefined); assert.equal(shown.voter_id, undefined);
  console.log("PASS: every vote transition, retries, concurrent votes, ownership protection, public attribution, and private voter data.");

  const ref = new URL(url).hostname.split('.')[0];
  async function sql(query) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {method: "POST", headers: {Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json"}, body: JSON.stringify({query, read_only: true})});
    assert.ok(response.ok); return response.json();
  }
  const [{start}] = await sql("select date_trunc('week', now() at time zone 'America/New_York') at time zone 'America/New_York' as start");
  const before = await fixture(a, new Date(Date.parse(start) - 1).toISOString());
  const boundary = await fixture(a, new Date(start).toISOString());
  const week = check(await anon.rpc("gallery_feed", {p_sort: "week", p_limit: 60}));
  assert.ok(week.items.some((item) => item.id === boundary.id));
  assert.ok(!week.items.some((item) => item.id === before.id));
  const dst = await sql("select (date_trunc('week', timestamptz '2026-03-09 03:59:59+00' at time zone 'America/New_York') at time zone 'America/New_York')::text as before, (date_trunc('week', timestamptz '2026-03-09 04:00:00+00' at time zone 'America/New_York') at time zone 'America/New_York')::text as after");
  assert.ok(dst[0].before.startsWith("2026-03-02 05:00")); assert.ok(dst[0].after.startsWith("2026-03-09 04:00"));
  await vote(a, boundary.id, 1); await vote(b, boundary.id, -1);
  const top = check(await anon.rpc("gallery_feed", {p_sort: "top", p_limit: 60}));
  assert.ok(top.items.findIndex((item) => item.id === photo.id) < top.items.findIndex((item) => item.id === boundary.id));
  assert.equal(top.items.find((item) => item.id === boundary.id).upvotes, 1);
  const sameTime = new Date(Date.now() - 1000).toISOString();
  const batch = Array.from({length: 35}, () => { const id = randomUUID(); photos.push(id); return {id, contributor_id: a.id, public_storage_path: `${a.id}/${id}.webp`, source: "upload", created_at: sameTime, published_at: sameTime}; });
  check(await admin.from("images").insert(batch));
  for (const sort of ["newest", "top", "week"]) {
    let cursor = null; const seen = new Set(); let loops = 0;
    do {
      const page = check(await anon.rpc("gallery_feed", {p_sort: sort, p_cursor: cursor, p_limit: 7}));
      for (const item of page.items) { assert.ok(!seen.has(item.id)); seen.add(item.id); }
      cursor = page.next_cursor; assert.ok(++loops < 100);
    } while (cursor);
    for (const item of batch) assert.ok(seen.has(item.id));
  }
  console.log("PASS: upvote-only rankings, New York weekly/DST boundaries, deterministic cursor pagination without duplicates.");

  assert.equal((await post("/api/gallery/upload", {size: 10 * 1024 * 1024 + 1, type: "image/png"}, a)).status, 400);
  const smallPng = await sharp({create: {width: 80, height: 120, channels: 3, background: "#6848ee"}}).png().toBuffer();
  const largePng = Buffer.concat([smallPng, Buffer.alloc(10 * 1024 * 1024 - smallPng.length)]);
  const valid = await ticket(a, largePng.length);
  const upload = await put(valid, largePng); assert.ok(upload.ok, "Direct signed 10 MB upload succeeds");
  assert.equal((await post("/api/gallery/publish", {assetId: valid.uploadId, source: "upload"}, b)).status, 400);
  const published = await successful("/api/gallery/publish", {assetId: valid.uploadId, source: "upload"}, a); photos.push(published.photoId);
  assert.equal((await successful("/api/gallery/publish", {assetId: valid.uploadId, source: "upload"}, a)).photoId, published.photoId);
  const row = check(await admin.from("images").select("*").eq("id", published.photoId).single());
  const publicUrl = admin.storage.from("gallery-photos").getPublicUrl(row.public_storage_path).data.publicUrl;
  const imageResponse = await fetch(publicUrl); assert.equal(imageResponse.status, 200);
  const meta = await sharp(Buffer.from(await imageResponse.arrayBuffer())).metadata();
  assert.equal(meta.format, "webp"); assert.equal(meta.width, 80); assert.equal(meta.height, 120); assert.equal(meta.exif, undefined);
  assert.ok((await admin.storage.from("gallery-staging").download(`${a.id}/${valid.uploadId}`)).error);
  const invalid = await ticket(a); assert.ok((await put(invalid, Buffer.from("not a photo"))).ok);
  assert.equal((await post("/api/gallery/publish", {assetId: invalid.uploadId, source: "upload"}, a)).status, 400);
  assert.equal(check(await admin.from("images").select("id").eq("id", invalid.uploadId)).length, 0);
  const tooLarge = await ticket(a);
  assert.ok(!(await put(tooLarge, Buffer.alloc(10 * 1024 * 1024 + 1))).ok, "Storage enforces actual size even if ticket metadata lied");
  const bigPixels = await sharp({create: {width: 5000, height: 5000, channels: 3, background: "#ffffff"}}).png().toBuffer();
  const megapixels = await ticket(a, bigPixels.length); assert.ok((await put(megapixels, bigPixels)).ok);
  assert.equal((await post("/api/gallery/publish", {assetId: megapixels.uploadId, source: "upload"}, a)).status, 400);
  const orphan = await ticket(a, smallPng.length); assert.ok((await put(orphan, smallPng)).ok);
  check(await admin.from("gallery_uploads").update({created_at: new Date(Date.now() - 25 * 3600_000).toISOString()}).eq("id", orphan.uploadId));
  console.log("PASS: direct 10 MB upload, publication ownership/idempotency, image re-encoding and aspect ratio, invalid/oversize/over-pixel rejection.");

  const generated = await fixture(a, undefined, true);
  const webp = await sharp(smallPng).webp().toBuffer();
  check(await admin.storage.from("generated-images").upload(generated.path, webp, {contentType: "image/webp"}));
  assert.deepEqual(check(await b.client.from("images").select("*").eq("id", generated.id)), []);
  assert.ok((await b.client.storage.from("generated-images").download(generated.path)).error);
  assert.ok((await anon.storage.from("generated-images").download(generated.path)).error);
  assert.ok(check(await a.client.storage.from("generated-images").download(generated.path)));
  assert.equal((await post("/api/gallery/publish", {assetId: generated.id, source: "generated"}, b)).status, 400);
  const results = await Promise.all([successful("/api/gallery/publish", {assetId: generated.id, source: "generated"}, a), successful("/api/gallery/publish", {assetId: generated.id, source: "generated"}, a)]);
  assert.equal(results[0].photoId, results[1].photoId); photos.push(results[0].photoId);
  assert.equal(check(await admin.from("images").select("id").eq("id", generated.id)).length, 1);
  const studio = await (await fetch(base + "/image-studio", {headers: {cookie: a.cookie()}})).text();
  assert.ok(studio.includes("Published to Avatar Gallery"));
  assert.ok(studio.includes("/storage/v1/object/sign/generated-images/"));
  console.log("PASS: generated images persist privately, survive refresh, enforce ownership, and publish exactly once under concurrency.");
} finally {
  // Remove storage through its API, never by deleting storage.objects rows.
  if (photos.length) check(await admin.from("images").delete().in("id", photos));
  for (const actor of users) {
    for (const name of ["gallery-photos", "gallery-staging", "generated-images"]) {
      const bucket = admin.storage.from(name);
      const objects = check(await bucket.list(actor.id, {limit: 1000}));
      if (objects.length) check(await bucket.remove(objects.map((object) => `${actor.id}/${object.name}`)));
    }
    check(await admin.auth.admin.deleteUser(actor.id));
  }
  console.log("Removed all temporary gallery users, records, and storage objects.");
}
