import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { generateRoast } from '../lib/roast/gemini.ts';
const originalFetch = globalThis.fetch;
const originalKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;
after(() => { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey; if (originalModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = originalModel; });
const input = { sessionId: 'test', requestId: 'test', settings: { intensity: 'playful', excludedTopics: ['work'] }, frames: [{ mimeType: 'image/jpeg', base64: '/9j/AA==', capturedAtMs: Date.now() }], events: [] };
test('Gemini adapter sends inline images, settings, bounded history and structured output configuration', async () => {
  process.env.GEMINI_API_KEY = 'fixture-not-a-real-key'; process.env.GEMINI_MODEL = 'gemini-3.8-flash';
  const result = { status: 'ok', roast: 'Your mug has main character energy.', anchor: 'screen' };
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith('/gemini-3.8-flash:generateContent'));
    const body = JSON.parse(options.body);
    assert.deepEqual(body.contents[0].parts[1], { inlineData: { mimeType: 'image/jpeg', data: '/9j/AA==' } });
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text).recentJokes, ['Previous roast']);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.ok(body.systemInstruction.parts[0].text.includes('protected traits'));
    return Response.json({ candidates: [{ content: { parts: [{ thought: true, text: 'internal' }, { text: JSON.stringify(result) }] } }] });
  };
  assert.deepEqual(await generateRoast(input, ['Previous roast'], new AbortController().signal), result);
});
test('refusals and malformed provider output become empty results; quota and missing config stay explicit', async () => {
  globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ text: 'invalid' }] } }] });
  assert.equal(await generateRoast(input, [], new AbortController().signal), null);
  globalThis.fetch = async () => Response.json({ promptFeedback: { blockReason: 'SAFETY' } });
  assert.equal(await generateRoast(input, [], new AbortController().signal), null);
  globalThis.fetch = async () => new Response(null, { status: 429 });
  await assert.rejects(generateRoast(input, [], new AbortController().signal), /QUOTA/);
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(generateRoast(input, [], new AbortController().signal), /CONFIG/);
});
