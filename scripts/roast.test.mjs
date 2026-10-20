import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validRequest, validOutput } from '../lib/roast/contracts.ts';
const input = () => ({ sessionId: 'session', requestId: 'request', settings: { intensity: 'playful', excludedTopics: [] }, frames: [{ mimeType: 'image/jpeg', base64: '/9j/AA==', capturedAtMs: Date.now() }], events: [] });
test('request bounds reject stale, oversized, malformed and unrestricted inputs', () => {
  assert.equal(validRequest(input()), true);
  for (const mutate of [r => r.settings.direction = 'x'.repeat(501), r => r.settings.direction = 3, r => r.frames = [], r => r.frames[0].base64 = 'data:image/jpeg;base64,AAA=', r => r.frames[0].capturedAtMs = 0, r => r.settings.intensity = 'anything', r => r.settings.excludedTopics = Array(11).fill('x'), r => r.events = [{ type: 'diagnosis', observedAtMs: Date.now() }], r => r.frames[0].base64 = 'a'.repeat(300000)]) {
    const r = input(); mutate(r); assert.equal(validRequest(r), false);
  }
});
test('output must be a bounded plain text roast or an explicit skip', () => {
  assert.equal(validOutput({ status: 'skip', roast: null, anchor: 'screen' }), true);
  assert.equal(validOutput({ status: 'ok', roast: 'A short roast.', anchor: 'face' }), true);
  assert.equal(validOutput({ status: 'ok', roast: '', anchor: 'face' }), false);
  assert.equal(validOutput({ status: 'ok', roast: 'x'.repeat(241), anchor: 'face' }), false);
  assert.equal(validOutput({ status: 'skip', roast: 'invented', anchor: 'screen' }), false);
});
test('streamed JSON body limit applies without trusting content-length', async () => {
  const { readBoundedJson } = await import('../lib/roast/read-body.ts');
  const make = content => new Request('http://localhost/api/roast', { method: 'POST', body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(content)); controller.close(); } }), duplex: 'half' });
  assert.deepEqual(await readBoundedJson(make('{"ok":true}'), 30), { ok: true });
  await assert.rejects(readBoundedJson(make('x'.repeat(31)), 30), /Body too large/);
  await assert.rejects(readBoundedJson(make('{bad json}'), 30));
});
