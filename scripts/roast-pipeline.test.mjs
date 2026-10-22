import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { registerHooks } from 'node:module';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

// Keep verified-auth behavior in the routes; replace only the request cookie client.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/lib/auth/server') return { url: 'roast-test:auth', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'roast-test:auth' || url.endsWith('/lib/auth/server.ts')) return {
      format: 'module', shortCircuit: true,
      source: 'export async function createAuthClient() { return globalThis.__roastAuthClient; }',
    };
    return next(url, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'fixture-signing-key';
process.env.ARK_API_KEY = 'fixture-ark-key';
process.env.GEMINI_API_KEY = 'fixture-gemini-key';
process.env.GEMINI_MODEL = 'gemini-3.8-flash';
process.env.ROAST_PROVIDER = 'gemini';
const { supabase } = await import('../lib/supabase.ts');
const { signReceipt, verifyReceipt } = await import('../lib/roast/receipt.ts');
const roastRoute = await import('../app/api/roast/route.ts');
const memeRoute = await import('../app/api/roast/meme/route.ts');
const saved = { fetch: globalThis.fetch, from: supabase.from, rpc: supabase.rpc, log: console.info };
after(() => { globalThis.fetch = saved.fetch; supabase.from = saved.from; supabase.rpc = saved.rpc; console.info = saved.log; });
const userId = randomUUID();
const roast = 'Those sunglasses are doing all the personality work.';
const jpeg = (await sharp({ create: { width: 80, height: 60, channels: 3, background: '#808080' } }).jpeg().toBuffer()).toString('base64');
const png = await sharp({ create: { width: 100, height: 75, channels: 3, background: '#abc' } }).png().toBuffer();
const downloadUrl = 'https://fixture.volces.com/generated.png';
const roastBody = () => ({ sessionId: randomUUID(), requestId: randomUUID(), settings: { intensity: 'savage', excludedTopics: [] }, frames: [{ mimeType: 'image/jpeg', base64: jpeg, capturedAtMs: Date.now() }], events: [] });
const memeBody = () => ({ receipt: signReceipt(userId, roast, jpeg), snapshot: jpeg });
const request = (path, body, origin = 'http://localhost:3000') => new Request(`http://localhost:3000/api/roast${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
let user, completed, providerFailure, finishFailures, current, calls, providers, logs;
beforeEach(() => {
  user = { id: userId }; completed = true; providerFailure = false; finishFailures = 0; current = true; calls = []; providers = []; logs = [];
  globalThis.__roastAuthClient = { auth: { async getUser() { return { data: { user }, error: null }; } } };
  supabase.from = table => {
    assert.equal(table, 'profiles');
    return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: completed ? { id: userId, onboarding_completed_at: '2026-10-01' } : null, error: null }; } };
  };
  supabase.rpc = async (name, args) => {
    assert.equal(name, 'ego_roast_lock'); calls.push(args);
    if (args.p_mode === 'finish' && finishFailures-- > 0) return { data: null, error: { message: 'unavailable' } };
    return { data: args.p_mode === 'acquire' ? { jokes: [] } : { current }, error: null };
  };
  console.info = (...args) => logs.push(args);
  globalThis.fetch = async (url, options) => {
    providers.push({ url: String(url), options });
    if (String(url).includes(':generateContent')) {
      if (providerFailure) return new Response(null, { status: 503 });
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ status: 'ok', roast, anchor: 'face' }) }] } }] });
    }
    if (String(url).endsWith('/images/generations')) {
      if (providerFailure) return new Response(null, { status: 503 });
      return Response.json({ data: [{ url: downloadUrl }] });
    }
    assert.equal(String(url), downloadUrl);
    return new Response(png, { headers: { 'Content-Type': 'image/png' } });
  };
});

test('a successful roast releases its lease exactly once before returning a bound receipt', async () => {
  const response = await roastRoute.POST(request('', roastBody()));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(verifyReceipt(result.receipt, userId, jpeg), roast);
  assert.deepEqual(calls.map(call => call.p_mode), ['acquire', 'finish']);
  assert.equal(calls[1].p_roast, roast);
  assert.match(response.headers.get('server-timing'), /auth;dur=.*acquire;dur=.*gemini;dur=.*finish;dur=.*total;dur=/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(providers.length, 1);
});
test('revoked rounds return no receipt without a second finish call', async () => {
  current = false;
  const response = await roastRoute.POST(request('', roastBody()));
  const result = await response.json();
  assert.equal(result.status, 'skip'); assert.equal(result.receipt, undefined);
  assert.deepEqual(calls.map(call => call.p_mode), ['acquire', 'finish']);
});
test('provider errors release the lease and a failed finish retries cleanup', async () => {
  providerFailure = true;
  assert.equal((await roastRoute.POST(request('', roastBody()))).status, 503);
  assert.deepEqual(calls.map(call => call.p_mode), ['acquire', 'finish']);
  assert.equal(calls[1].p_roast, null);
  providerFailure = false; calls = []; finishFailures = 1;
  assert.equal((await roastRoute.POST(request('', roastBody()))).status, 503);
  assert.deepEqual(calls.map(call => call.p_mode), ['acquire', 'finish', 'finish']);
  assert.equal(calls[2].p_roast, null);
});
test('meme generation retains Seedream output, prompt, model and resolution with separate stage timings', async () => {
  const response = await memeRoute.POST(request('/meme', memeBody()));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(verifyReceipt(result.receipt, userId, result.snapshot, 'meme'), roast);
  const actual = Buffer.from(result.snapshot, 'base64');
  const expected = await sharp(png).webp({ quality: 85 }).toBuffer();
  assert.deepEqual(actual, expected);
  const body = JSON.parse(providers[0].options.body);
  assert.equal(body.model, 'doubao-seedream-5-0-flash-260915');
  assert.equal(body.size, '2K'); assert.equal(body.watermark, true);
  assert.equal(body.image, `data:image/jpeg;base64,${jpeg}`);
  assert.ok(body.prompt.includes(JSON.stringify(roast)));
  assert.match(response.headers.get('server-timing'), /auth;dur=.*seedream;dur=.*download;dur=.*compress;dur=.*total;dur=/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(providers.length, 2);
  const log = JSON.stringify(logs);
  for (const secret of [userId, jpeg, roast, 'fixture-ark-key', downloadUrl]) assert.ok(!log.includes(secret));
});
test('invalid origins, missing sessions and incomplete profiles cannot reach either provider', async () => {
  for (const [route, path, body] of [[roastRoute, '', roastBody()], [memeRoute, '/meme', memeBody()]]) {
    assert.equal((await route.POST(request(path, body, 'https://other.example'))).status, 403);
    user = null;
    assert.equal((await route.POST(request(path, body))).status, 401);
    user = { id: userId }; completed = false;
    assert.equal((await route.POST(request(path, body))).status, 401);
    completed = true;
  }
  assert.equal(providers.length, 0); assert.equal(calls.length, 0);
});
test('invalid receipts never generate images and provider failures stay retryable without partial images', async () => {
  assert.equal((await memeRoute.POST(request('/meme', { ...memeBody(), receipt: 'forged' }))).status, 400);
  assert.equal(providers.length, 0);
  providerFailure = true;
  const failure = await memeRoute.POST(request('/meme', memeBody()));
  assert.equal(failure.status, 400); assert.equal((await failure.json()).snapshot, undefined);
  assert.match(failure.headers.get('server-timing'), /seedream;dur=/);
  assert.ok(!failure.headers.get('server-timing').includes('download'));
  providerFailure = false;
  assert.equal((await memeRoute.POST(request('/meme', memeBody()))).status, 200);
});
