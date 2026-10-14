import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:3000', pretendToBeVisual: true });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'MutationObserver', 'Node', 'Event', 'MouseEvent', 'getComputedStyle', 'navigator']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/react');
const { RoastStudio } = await import('../app/you-are-a-joke/studio.tsx');
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });
const mount = (mock = true, configured = true) => render(React.createElement(RoastStudio, { mock, configured }));
test('camera remains closed until acknowledgement and explicit start', async () => {
  let calls = 0; Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { calls++; throw new DOMException('denied', 'NotAllowedError'); } } });
  const ui = mount(false); const button = ui.getByRole('button', { name: /Start Experience/ });
  assert.equal(button.disabled, true); assert.equal(calls, 0);
  fireEvent.click(ui.getByRole('checkbox')); assert.equal(calls, 0); assert.equal(button.disabled, false);
  fireEvent.click(button); await waitFor(() => assert.equal(calls, 1));
  await waitFor(() => assert.ok(ui.getByText(/Camera permission was blocked/)));
});
test('late permission after cancellation immediately stops the stream', async () => {
  let resolve; let stopped = 0;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => new Promise(r => resolve = r) } });
  const ui = mount(); fireEvent.click(ui.getByRole('checkbox')); fireEvent.click(ui.getByRole('button', { name: /Start Experience/ }));
  fireEvent.click(ui.getByRole('button', { name: 'Cancel camera request' }));
  resolve({ getTracks: () => [{ stop: () => stopped++ }] });
  await waitFor(() => assert.equal(stopped, 1)); assert.ok(ui.getByText(/Camera off/));
});
test('mock mode makes no uploads and missing configuration cannot start', () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return new Response(); };
  const ui = mount(true, false); fireEvent.click(ui.getByRole('checkbox'));
  assert.equal(ui.getByRole('button', { name: /Start Experience/ }).disabled, true);
  assert.ok(ui.getByText(/no camera snapshots are uploaded/)); assert.equal(calls, 0);
});

async function liveHarness(mock = false) {
  const { act } = await import('@testing-library/react');
  let raf; let stopped = 0; const workers = [];
  globalThis.requestAnimationFrame = fn => { raf = fn; return 1; };
  globalThis.Worker = class {
    constructor() { workers.push(this); }
    postMessage(data) { if (data.type === 'init') queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } })); }
    terminate() {}
  };
  globalThis.createImageBitmap = async () => ({ close() {} });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => stopped++ }] }) } });
  dom.window.HTMLMediaElement.prototype.play = async () => {};
  dom.window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
  dom.window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,/9j/AA==';
  const ui = mount(mock);
  const v = ui.getByLabelText('Mirrored live webcam');
  for (const [name, value] of Object.entries({ readyState: 2, videoWidth: 640, videoHeight: 480 })) Object.defineProperty(v, name, { configurable: true, value });
  fireEvent.click(ui.getByRole('checkbox'));
  fireEvent.click(ui.getByRole('button', { name: /Start Experience/ }));
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Pause roasting' })));
  const points = Array.from({ length: 478 }, () => ({ x: .5, y: .5 })); points[263] = { x: .7, y: .4 }; points[33] = { x: .3, y: .4 };
  const faces = async count => act(async () => workers.at(-1).onmessage({ data: { type: 'result', landmarks: Array.from({ length: count }, () => points), blendshapes: [] } }));
  const tick = async time => act(async () => raf(time));
  return { ui, faces, tick, stopped: () => stopped };
}

test('clear invalidates an outstanding roast and stop releases the camera', async () => {
  let resolve; let sent;
  globalThis.fetch = (url, options) => {
    if (url.endsWith('/reset')) return Promise.resolve(new Response(null, { status: 204 }));
    sent = JSON.parse(options.body); return new Promise(r => resolve = r);
  };
  const { ui, faces, tick, stopped } = await liveHarness();
  await faces(1); await tick(100);
  assert.ok(sent); assert.equal(sent.frames.length, 1);
  fireEvent.click(ui.getByRole('button', { name: 'Clear Session' }));
  const { act } = await import('@testing-library/react');
  await act(async () => resolve(Response.json({ sessionId: sent.sessionId, requestId: sent.requestId, status: 'ok', roast: 'STALE CAPTION', anchor: 'screen' })));
  assert.equal(ui.queryByText('STALE CAPTION'), null);
  fireEvent.click(ui.getByRole('button', { name: 'Stop Camera' }));
  assert.equal(stopped(), 1); assert.equal(ui.getByLabelText('Mirrored live webcam').srcObject, null);
});

test('multiple faces prevent uploads and revoking consent keeps roasting paused', async () => {
  let uploads = 0; globalThis.fetch = async url => { if (!url.endsWith('/reset')) uploads++; return new Response(null, { status: 204 }); };
  const { ui, faces, tick } = await liveHarness();
  await faces(2); await tick(100);
  assert.equal(uploads, 0); assert.ok(ui.getByText(/One participant only/));
  fireEvent.click(ui.getByRole('checkbox')); await faces(1); await tick(200);
  assert.equal(uploads, 0); assert.equal(ui.getByRole('button', { name: 'Resume roasting' }).disabled, true);
});

test('mock tracking never uploads frames and unmount stops camera tracks', async () => {
  let uploads = 0; globalThis.fetch = async url => { if (!url.endsWith('/reset')) uploads++; return new Response(null, { status: 204 }); };
  const { ui, faces, tick, stopped } = await liveHarness(true);
  await faces(1); await tick(100); assert.equal(uploads, 0);
  ui.unmount(); assert.equal(stopped(), 1);
});
