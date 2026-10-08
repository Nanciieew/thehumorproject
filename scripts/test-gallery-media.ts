// node --env-file=.env.local --conditions=react-server --import tsx scripts/test-gallery-media.ts
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { supabase } from "../lib/supabase";
import { cleanupGalleryStaging, publishGalleryImage, saveGeneratedImage } from "../lib/gallery-media";

async function main() {
  const originalFetch = globalThis.fetch;
  let userId: string | undefined;
  try {
    const created = await supabase.auth.admin.createUser({email: `gallery-media-${randomUUID()}@example.com`, email_confirm: true});
    assert.ifError(created.error); userId = created.data.user!.id;
    const profile = await supabase.from("profiles").insert({id: userId, first_name: "Media", last_name: "Tester", state_code: "NY", onboarding_completed_at: new Date().toISOString()});
    assert.ifError(profile.error);
    const image = await sharp({create: {width: 96, height: 64, channels: 3, background: "#bada55"}}).png().toBuffer();
    let sourceAvailable = true; let sourceRequests = 0;
    globalThis.fetch = async (input, options) => {
      const address = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (address.hostname === "fixture.volces.com") {
        sourceRequests++;
        return sourceAvailable ? new Response(new Uint8Array(image), {headers: {"Content-Type": "image/png"}}) : new Response(null, {status: 403});
      }
      return originalFetch(input, options);
    };
    await assert.rejects(saveGeneratedImage(userId, "http://127.0.0.1/private"), /unsupported download address/);
    await assert.rejects(saveGeneratedImage(userId, "https://volces.com.attacker.invalid/private"), /unsupported download address/);
    const saved = await saveGeneratedImage(userId, "https://fixture.volces.com/image.png");
    assert.equal(sourceRequests, 1);
    sourceAvailable = false;
    const preview = await originalFetch(saved.url); assert.equal(preview.status, 200);
    const publication = await publishGalleryImage(userId, saved.generationId, "generated");
    assert.equal(publication, saved.generationId); assert.equal(sourceRequests, 1);
    assert.equal(await publishGalleryImage(userId, saved.generationId, "generated"), publication);
    console.log("PASS: generated download persisted, preview and publication work after source expires; untrusted URLs rejected.");

    const expired = randomUUID(); const fresh = randomUUID();
    for (const [id, age] of [[expired, 25], [fresh, 1]] as const) {
      const storage_path = `${userId}/${id}`;
      const record = await supabase.from("gallery_uploads").insert({id, contributor_id: userId, storage_path, created_at: new Date(Date.now() - age * 3600_000).toISOString()});
      assert.ifError(record.error);
      const upload = await supabase.storage.from("gallery-staging").upload(storage_path, image, {contentType: "image/png"}); assert.ifError(upload.error);
    }
    await cleanupGalleryStaging();
    const gone = await supabase.from("gallery_uploads").select("id").eq("id", expired); assert.ifError(gone.error); assert.equal(gone.data.length, 0);
    assert.ok((await supabase.storage.from("gallery-staging").download(`${userId}/${expired}`)).error);
    assert.ifError((await supabase.storage.from("gallery-staging").download(`${userId}/${fresh}`)).error);
    console.log("PASS: expired staging objects and records removed; fresh upload retained.");
  } finally {
    globalThis.fetch = originalFetch;
    if (userId) {
      await supabase.from("images").delete().eq("contributor_id", userId);
      for (const name of ["gallery-staging", "gallery-photos", "generated-images"]) {
        const bucket = supabase.storage.from(name); const objects = await bucket.list(userId);
        assert.ifError(objects.error);
        if (objects.data.length) assert.ifError((await bucket.remove(objects.data.map((object) => `${userId}/${object.name}`))).error);
      }
      assert.ifError((await supabase.auth.admin.deleteUser(userId)).error);
    }
    console.log("Removed temporary media test account and objects.");
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
