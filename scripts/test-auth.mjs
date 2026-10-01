// Integration test: starts from an already running local app, creates one
// temporary Auth user, and removes it (and its profile) in finally.
// Run: node --env-file=.env.local scripts/test-auth.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import sharp from "sharp";

const base = "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const decode = (s) => s.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&");
function formData(html, contains) {
  const form = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)]
    .map((m) => m[0]).find((f) => f.includes(contains));
  assert.ok(form, `Form ${contains} exists`);
  const data = new FormData();
  for (const [tag] of form.matchAll(/<input\b[^>]*>/g)) {
    if (!tag.includes('type="hidden"')) continue;
    const name = tag.match(/\bname="([^"]*)"/);
    const value = tag.match(/\bvalue="([^"]*)"/);
    if (name) data.append(decode(name[1]), decode(value?.[1] || ""));
  }
  return data;
}
async function assertRedirect(response, path) {
  const location = response.headers.get("location");
  if (location) assert.equal(location, path);
  else {
    // Next.js can emit a meta redirect after streaming the loading boundary.
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.ok(body.includes(`url=${path}"`), `Expected streaming redirect to ${path}`);
  }
}
let response = await fetch(base, { redirect: "manual" });
assert.equal(response.status, 200);
assert.match(await response.text(), /Log in/);
await assertRedirect(await fetch(base + "/profile/complete", { redirect: "manual" }), "/login");
await assertRedirect(await fetch(base + "/profile", { redirect: "manual" }), "/login");
await assertRedirect(await fetch(base + "/auth/callback?error=access_denied", { redirect: "manual" }), "/login?error=oauth");
const loginHtml = await (await fetch(base + "/login")).text();
response = await fetch(base + "/login", {
  method: "POST", headers: { origin: base }, body: formData(loginHtml, "Continue with Google"), redirect: "manual",
});
assert.equal(response.status, 303);
const authUrl = new URL(response.headers.get("location"));
assert.equal(authUrl.hostname, new URL(url).hostname);
assert.equal(authUrl.searchParams.get("provider"), "google");
assert.equal(authUrl.searchParams.get("redirect_to"), base + "/auth/callback");
assert.ok(authUrl.searchParams.get("code_challenge"));
const google = await fetch(authUrl, { redirect: "manual" });
assert.equal(google.status, 302);
assert.equal(new URL(google.headers.get("location")).hostname, "accounts.google.com");
console.log("PASS: anonymous pages, protected profile, cancelled OAuth, Google redirect and PKCE.");

const jar = new Map();
const auth = createServerClient(url, process.env.SUPABASE_PUBLISHABLE_KEY, {
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (values) => values.forEach(({ name, value }) => jar.set(name, value)),
  },
});
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
const email = `oauth-profile-test-${randomUUID()}@example.com`;
const password = randomUUID() + randomUUID();
let id;
try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  id = created.data.user.id;
  const signed = await auth.auth.signInWithPassword({ email, password });
  assert.ifError(signed.error);
  await assertRedirect(await fetch(base, { headers: { cookie: cookie() }, redirect: "manual" }), "/profile/complete");
  let html = await (await fetch(base + "/profile/complete", { headers: { cookie: cookie() } })).text();
  assert.match(html, /name="first_name"/);
  assert.match(html, /name="last_name"/);
  let form = formData(html, "first_name");
  form.set("first_name", "   ");
  form.set("last_name", "Tester");
  response = await fetch(base + "/profile/complete", {
    method: "POST", headers: { origin: base, cookie: cookie() }, body: form, redirect: "manual",
  });
  assert.match(await response.text(), /Enter both names/);
  let row = await admin.from("profiles").select("first_name,last_name").eq("id", id).single();
  assert.ifError(row.error);
  assert.equal(row.data.first_name, null);
  console.log("PASS: first sign-in creates profile; whitespace-only names rejected.");

  const preset = await admin.from("profiles").update({ first_name: "Existing", last_name: "   " }).eq("id", id);
  assert.ifError(preset.error);
  html = await (await fetch(base + "/profile/complete", { headers: { cookie: cookie() } })).text();
  assert.doesNotMatch(html, /<input[^>]*name="first_name"/);
  assert.match(html, /<input[^>]*name="last_name"/);
  form = formData(html, "last_name");
  form.set("first_name", "Overwrite attempt");
  form.set("last_name", "  Tester  ");
  await assertRedirect(await fetch(base + "/profile/complete", {
    method: "POST", headers: { origin: base }, body: form, redirect: "manual",
  }), "/login");
  response = await fetch(base + "/profile/complete", {
    method: "POST", headers: { origin: base, cookie: cookie() }, body: form, redirect: "manual",
  });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/");
  row = await admin.from("profiles").select("first_name,last_name").eq("id", id).single();
  assert.ifError(row.error);
  assert.equal(row.data.first_name, "Existing");
  assert.equal(row.data.last_name, "Tester");
  console.log("PASS: unauthenticated writes blocked; missing name saved; existing name preserved.");
  await assertRedirect(await fetch(base + "/profile/complete", { headers: { cookie: cookie() }, redirect: "manual" }), "/");

  // Profile editing uses the session's user ID, never an ID supplied in the form.
  async function editorForm() {
    const page = await fetch(base + "/profile", { headers: { cookie: cookie() } });
    assert.equal(page.status, 200);
    const data = formData(await page.text(), 'name="photo"');
    data.set("first_name", "Updated");
    data.set("last_name", "Person");
    data.set("id", randomUUID());
    return data;
  }
  async function saveEditor(data, authenticated = true) {
    return fetch(base + "/profile", {
      method: "POST", headers: { origin: base, ...(authenticated ? { cookie: cookie() } : {}) },
      body: data, redirect: "manual",
    });
  }
  await assertRedirect(await saveEditor(await editorForm(), false), "/login");
  form = await editorForm();
  form.set("photo", new Blob(["not an image"], { type: "image/png" }), "fake.png");
  assert.match(await (await saveEditor(form)).text(), /photo couldn/);
  row = await admin.from("profiles").select("first_name,avatar_path").eq("id", id).single();
  assert.ifError(row.error);
  assert.equal(row.data.first_name, "Existing");
  assert.equal(row.data.avatar_path, null);
  form = await editorForm();
  form.set("photo", new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: "image/png" }), "large.png");
  assert.match(await (await saveEditor(form)).text(), /smaller than 2 MB/);
  console.log("PASS: profile writes require login; invalid and oversized photos rejected without changing data.");

  const image = await sharp({ create: { width: 40, height: 60, channels: 3, background: "#5d81ff" } }).png().toBuffer();
  form = await editorForm();
  form.set("photo", new Blob([image], { type: "image/png" }), "portrait.png");
  assert.match(await (await saveEditor(form)).text(), /Your profile has been saved/);
  row = await admin.from("profiles").select("first_name,last_name,avatar_path").eq("id", id).single();
  assert.ifError(row.error);
  assert.equal(row.data.first_name, "Updated");
  assert.equal(row.data.last_name, "Person");
  const firstPath = row.data.avatar_path;
  assert.ok(firstPath.startsWith(id + "/"));
  assert.ok(firstPath.endsWith(".webp"));
  const bucket = admin.storage.from("profile-photos");
  const photo = await bucket.download(firstPath);
  assert.ifError(photo.error);
  const metadata = await sharp(Buffer.from(await photo.data.arrayBuffer())).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  assert.equal(metadata.exif, undefined);
  const unsigned = createClient(url, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  assert.ok((await unsigned.storage.from("profile-photos").download(firstPath)).error);
  const signedPhoto = await bucket.createSignedUrl(firstPath, 60);
  assert.ifError(signedPhoto.error);
  assert.equal((await fetch(signedPhoto.data.signedUrl)).status, 200);
  const savedPage = await (await fetch(base + "/profile", { headers: { cookie: cookie() } })).text();
  assert.match(savedPage, /Your profile photo/);
  assert.ok(savedPage.includes("/storage/v1/object/sign/profile-photos/"));
  console.log("PASS: names updated; image saved in private Storage; only its path stored in profiles; signed photo renders.");

  form = await editorForm();
  form.set("photo", new Blob([image], { type: "image/png" }), "replacement.png");
  assert.match(await (await saveEditor(form)).text(), /Your profile has been saved/);
  row = await admin.from("profiles").select("avatar_path").eq("id", id).single();
  assert.ifError(row.error);
  assert.notEqual(row.data.avatar_path, firstPath);
  assert.ok((await bucket.download(firstPath)).error);
  const keptPath = row.data.avatar_path;
  form = await editorForm();
  form.set("first_name", "Renamed");
  assert.match(await (await saveEditor(form)).text(), /Your profile has been saved/);
  row = await admin.from("profiles").select("avatar_path,first_name").eq("id", id).single();
  assert.ifError(row.error);
  assert.equal(row.data.avatar_path, keptPath);
  assert.equal(row.data.first_name, "Renamed");
  console.log("PASS: replacement removes old image; name-only edit preserves photo.");
  html = await (await fetch(base, { headers: { cookie: cookie() } })).text();
  assert.match(html, /Renamed/);
  response = await fetch(base, {
    method: "POST", headers: { origin: base, cookie: cookie() }, body: formData(html, "Log out"), redirect: "manual",
  });
  assert.equal(response.status, 303);
  assert.ok(response.headers.getSetCookie().some((c) => c.includes("Max-Age=0")));
  console.log("PASS: completed users return home; logout clears cookies.");
} finally {
  if (id) {
    const bucket = admin.storage.from("profile-photos");
    const objects = await bucket.list(id);
    assert.ifError(objects.error);
    if (objects.data.length) {
      const cleanup = await bucket.remove(objects.data.map((object) => `${id}/${object.name}`));
      assert.ifError(cleanup.error);
    }
    const removed = await admin.auth.admin.deleteUser(id);
    assert.ifError(removed.error);
    const remaining = await admin.from("profiles").select("id").eq("id", id);
    assert.ifError(remaining.error);
    assert.equal(remaining.data.length, 0);
    console.log("Temporary Auth user and profile removed.");
  }
}
