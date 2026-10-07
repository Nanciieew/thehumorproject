import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:3000' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'MutationObserver', 'Node', 'Event', 'MouseEvent', 'getComputedStyle', 'File', 'FileReader', 'Blob']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/react');
const { ImageStudio } = await import('../app/image-studio/studio.tsx');
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });
const mount = (configured = true) => render(React.createElement(ImageStudio, { configured, saved: [] }));
test('missing server configuration disables both generation actions', () => {
  const ui = mount(false);
  fireEvent.change(ui.getByLabelText('Your prompt'), { target: { value: 'A funny portrait' } });
  assert.equal(ui.getByRole('button', { name: 'Generate photo' }).disabled, true);
  assert.equal(ui.getByRole('button', { name: 'Run sample test' }).disabled, true);
});
test('generation sends the prompt and selected reference, then displays the saved result', async () => {
  let body;
  globalThis.fetch = async (_url, options) => { body = JSON.parse(options.body); return Response.json({ url: 'https://example.com/generated.png', generationId: 'saved-photo' }); };
  const ui = mount();
  const file = new File([new Uint8Array([1, 2, 3])], 'reference.png', { type: 'image/png' });
  fireEvent.change(ui.container.querySelector('#reference-photo'), { target: { files: [file] } });
  await waitFor(() => assert.ok(ui.getByAltText('Selected reference photo')));
  fireEvent.change(ui.getByLabelText('Your prompt'), { target: { value: 'A funny portrait' } });
  fireEvent.click(ui.getByRole('button', { name: 'Generate photo' }));
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Publish to gallery' })));
  assert.equal(body.prompt, 'A funny portrait');
  assert.equal(body.image, 'data:image/png;base64,AQID');
});
test('sample test sends a text prompt and surfaces provider failures without locking the controls', async () => {
  let body;
  globalThis.fetch = async (_url, options) => { body = JSON.parse(options.body); return Response.json({ error: 'Ark usage limit reached' }, { status: 502 }); };
  const ui = mount();
  fireEvent.click(ui.getByRole('button', { name: 'Run sample test' }));
  await waitFor(() => assert.ok(ui.getByText('Ark usage limit reached')));
  assert.ok(body.prompt.includes('black hole'));
  assert.equal(body.image, undefined);
  assert.equal(ui.getByRole('button', { name: 'Run sample test' }).disabled, false);
});
