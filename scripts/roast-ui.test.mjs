import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:3000', pretendToBeVisual: true });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'MutationObserver', 'Node', 'Event', 'MouseEvent', 'getComputedStyle', 'navigator']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
globalThis.self = dom.window;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, fireEvent, waitFor, cleanup, act } = await import('@testing-library/react');
const { RoastStudio } = await import('../app/you-are-a-joke/studio.tsx');
const { PublishEgo } = await import('../app/you-are-a-joke/publish-ego.tsx');
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); window.sessionStorage.clear(); globalThis.fetch = originalFetch; });
const mount = (mock = true, configured = true) => render(React.createElement(RoastStudio, { mock, configured }));
test('camera remains closed until acknowledgement and explicit start', async () => {
  let calls = 0; Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { calls++; throw new DOMException('denied', 'NotAllowedError'); } } });
  const ui = mount(false); const button = ui.getByRole('button', { name: /Check my ego/ });
  assert.equal(button.disabled, true); assert.equal(calls, 0);
  fireEvent.click(ui.getByRole('checkbox')); assert.equal(calls, 0); assert.equal(button.disabled, false);
  fireEvent.click(button); await waitFor(() => assert.equal(calls, 1));
  await waitFor(() => assert.ok(ui.getByText(/Camera permission was blocked/)));
});
test('late permission after cancellation immediately stops the stream', async () => {
  let resolve; let stopped = 0;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => new Promise(r => resolve = r) } });
  const ui = mount(); fireEvent.click(ui.getByRole('checkbox')); fireEvent.click(ui.getByRole('button', { name: /Check my ego/ }));
  fireEvent.click(ui.getByRole('button', { name: 'Cancel camera request' }));
  resolve({ getTracks: () => [{ stop: () => stopped++ }] });
  await waitFor(() => assert.equal(stopped, 1)); assert.ok(ui.getByText(/Camera off/));
});
test('mock mode makes no uploads and missing configuration cannot start', () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return new Response(); };
  const ui = mount(true, false); fireEvent.click(ui.getByRole('checkbox'));
  assert.equal(ui.getByRole('button', { name: /Check my ego/ }).disabled, true);
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
  fireEvent.click(ui.getByRole('button', { name: /Check my ego/ }));
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Cancel roast' })));
  const points = Array.from({ length: 478 }, () => ({ x: .5, y: .5 })); points[263] = { x: .7, y: .4 }; points[33] = { x: .3, y: .4 };
  const faces = async count => act(async () => workers.at(-1).onmessage({ data: { type: 'result', landmarks: Array.from({ length: count }, () => points), blendshapes: [] } }));
  const tick = async time => act(async () => raf(time));
  return { ui, faces, tick, stopped: () => stopped };
}

test('cancel invalidates an outstanding roast and leaving releases the camera without extra controls', async () => {
  let resolve; let sent;
  globalThis.fetch = (url, options) => {
    if (url.endsWith('/reset')) return Promise.resolve(new Response(null, { status: 204 }));
    sent = JSON.parse(options.body); return new Promise(r => resolve = r);
  };
  const { ui, faces, tick, stopped } = await liveHarness();
  await faces(1); await tick(100);
  assert.ok(sent); assert.equal(sent.frames.length, 1);
  assert.equal(ui.queryByRole('button', {name:'Clear Session'}),null);
  assert.equal(ui.queryByRole('button', {name:'Stop Camera'}),null);
  fireEvent.click(ui.getByRole('button', { name: 'Cancel roast' }));
  const { act } = await import('@testing-library/react');
  await act(async () => resolve(Response.json({ sessionId: sent.sessionId, requestId: sent.requestId, status: 'ok', roast: 'STALE CAPTION', anchor: 'screen' })));
  assert.equal(ui.queryByText('STALE CAPTION'), null);
  ui.unmount();
  assert.equal(stopped(), 1);
});

test('multiple faces prevent uploads and revoking consent keeps roasting paused', async () => {
  let uploads = 0; globalThis.fetch = async url => { if (!url.endsWith('/reset')) uploads++; return new Response(null, { status: 204 }); };
  const { ui, faces, tick } = await liveHarness();
  await faces(2); await tick(100);
  assert.equal(uploads, 0); assert.ok(ui.getByText(/One participant only/));
  fireEvent.click(ui.getByRole('checkbox')); await faces(1); await tick(200);
  assert.equal(uploads, 0); assert.equal(ui.getByRole('button', { name: 'Try again' }).disabled, true);
});

test('mock tracking never uploads frames and unmount stops camera tracks', async () => {
  let uploads = 0; globalThis.fetch = async url => { if (!url.endsWith('/reset')) uploads++; return new Response(null, { status: 204 }); };
  const { ui, faces, tick, stopped } = await liveHarness(true);
  await faces(1); await tick(100); assert.equal(uploads, 0);
  ui.unmount(); assert.equal(stopped(), 1);
});

test('one click produces one roast, preserves its receipt while paused, and needs another click for the next', async t => {
  let now = Date.now(); t.mock.method(Date, 'now', () => now);
  const sent = [], replies = [], memes = [];
  globalThis.fetch = (url, options) => {
    if (url.endsWith('/reset')) return Promise.resolve(new Response(null, { status: 204 }));
    if (url === '/api/roast/meme') return new Promise(resolve => memes.push({ body: JSON.parse(options.body), resolve }));
    assert.equal(url, '/api/roast');
    sent.push(JSON.parse(options.body));
    return new Promise(resolve => replies.push(resolve));
  };
  const { ui, faces, tick } = await liveHarness();
  assert.equal(ui.queryByRole('button', { name: 'Challenge a friend ↗' }), null);
  assert.ok(!ui.queryByRole('button', { name: 'Publish my ego' }) || ui.getByRole('button', { name: 'Publish my ego' }).disabled);
  await faces(1); await tick(100); await tick(200); await tick(300);
  assert.equal(ui.queryByRole('button', { name: 'Challenge a friend ↗' }), null);
  assert.ok(!ui.queryByRole('button', { name: 'Publish my ego' }) || ui.getByRole('button', { name: 'Publish my ego' }).disabled);
  assert.equal(sent.length, 1, 'an in-flight request cannot overlap another');
  const respond = async (index, roast) => act(async () => replies[index](Response.json({
    sessionId: sent[index].sessionId, requestId: sent[index].requestId,
    status: 'ok', roast, anchor: 'screen', receipt: `receipt-${index}`,
  })));
  await respond(0, 'First roast.');
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Try again' })));
  assert.equal(ui.queryByRole('button', { name: 'Challenge a friend ↗' }), null);
  assert.ok(ui.getByText(/Paused — camera is on/));
  assert.equal(memes.length, 1);
  assert.equal(memes[0].body.receipt, 'receipt-0');
  assert.equal(ui.queryByAltText('The screenshot captured for your punchline'),null);
  assert.equal(ui.queryByText('Adding your punchline to the screenshot…'),null);
  assert.equal(ui.queryByText('THE PUNCHLINE'),null);
  assert.equal(ui.queryByRole('region',{name:'Your punchline'}),null);
  assert.equal(ui.queryByText('Your screenshot is taking shape.'),null);
  assert.equal(ui.queryByText('First roast.'),null);
  assert.equal(ui.queryByRole('link',{name:'Checked Factory ↗'}),null);
  assert.ok(!ui.queryByRole('button', { name: 'Publish my ego' }) || ui.getByRole('button', { name: 'Publish my ego' }).disabled);
  await act(async () => memes[0].resolve(Response.json({ snapshot: 'Z2VuZXJhdGVk', receipt: 'meme-receipt' })));
  assert.equal(ui.getByAltText('Your checked screenshot').getAttribute('src'), 'data:image/webp;base64,Z2VuZXJhdGVk');
  const publish = ui.getByRole('button', { name: 'Publish my ego' });
  assert.ok(ui.getByRole('region', { name: 'Experience controls' }).contains(publish));
  assert.equal(publish.parentElement,ui.getByRole('button',{name:'Try again'}).parentElement);
  assert.equal(ui.queryByRole('button',{name:'Hurt my feelings again ↗'}),null);
  assert.equal(ui.getByRole('region', {name:'Camera preview'}).contains(publish),false);
  assert.equal(ui.queryByRole('link',{name:'Checked Factory ↗'}),null);
  assert.equal(ui.queryByText('One roast per click.'),null);
  assert.equal(ui.queryByText('Privacy & camera'),null);
  now += 9000; await faces(1); await tick(10000); await tick(11000);
  assert.equal(sent.length, 1, 'elapsed cooldown and tracking cannot start another roast');
  assert.ok(ui.getByRole('button', { name: 'Publish my ego' }), 'publishing remains available while paused');
  fireEvent.click(ui.getByRole('button', { name: 'Try again' }));
  assert.equal(ui.queryByRole('button', { name: 'Challenge a friend ↗' }), null);
  assert.ok(!ui.queryByRole('button', { name: 'Publish my ego' }) || ui.getByRole('button', { name: 'Publish my ego' }).disabled);
  await tick(12000); await tick(13000);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].sessionId, sent[0].sessionId, 'follow-up requests retain server joke history');
  await respond(1, 'Second roast.');
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Try again' })));
  assert.equal(ui.queryByText('First roast.'), null);
  assert.equal(ui.queryByText('Second roast.'),null);
});

for (const outcome of ['skip', 'error']) {
  test(`${outcome} pauses without an automatic retry`, async t => {
    let now = Date.now(); t.mock.method(Date, 'now', () => now);
    let uploads = 0;
    globalThis.fetch = async (url, options) => {
      if (url.endsWith('/reset')) return new Response(null, { status: 204 });
      assert.equal(url, '/api/roast'); uploads++;
      const body = JSON.parse(options.body);
      return outcome === 'skip'
        ? Response.json({ sessionId: body.sessionId, requestId: body.requestId, status: 'skip', roast: null, anchor: 'screen' })
        : Response.json({ message: 'Provider unavailable.' }, { status: 503 });
    };
    const { ui, faces, tick } = await liveHarness();
    await faces(1); await tick(100);
    await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Try again' })));
    assert.equal(ui.queryByRole('button', { name: 'Challenge a friend ↗' }), null);
  assert.ok(!ui.queryByRole('button', { name: 'Publish my ego' }) || ui.getByRole('button', { name: 'Publish my ego' }).disabled);
    assert.ok(ui.getByText(outcome === 'skip' ? 'No roast came back. Try again when you’re ready.' : 'Provider unavailable.'));
    now += 9000; await faces(1); await tick(10000); assert.equal(uploads, 1);
    fireEvent.click(ui.getByRole('button', { name: 'Try again' }));
    await tick(11000); await waitFor(() => assert.equal(uploads, 2));
    await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Try again' })));
  });
}

test('losing a face during a request cancels the round and returning cannot trigger another', async t => {
  let now = Date.now(); t.mock.method(Date, 'now', () => now);
  let resolve, sent, signal, uploads = 0;
  globalThis.fetch = (url, options) => {
    if (url.endsWith('/reset')) return Promise.resolve(new Response(null, { status: 204 }));
    assert.equal(url, '/api/roast'); uploads++; sent = JSON.parse(options.body); signal = options.signal;
    return new Promise(r => resolve = r);
  };
  const { ui, faces, tick } = await liveHarness();
  await faces(1); await tick(100); await faces(2);
  assert.equal(signal.aborted, true);
  await act(async () => resolve(Response.json({ sessionId: sent.sessionId, requestId: sent.requestId, status: 'ok', roast: 'Late roast.', anchor: 'screen' })));
  assert.equal(ui.queryByText('Late roast.'), null);
  now += 9000; await faces(1); await tick(10000);
  assert.equal(uploads, 1);
  assert.ok(ui.getByRole('button', { name: 'Try again' }));
});

test('changing settings cancels a pending round and waits for another click', async t => {
  let now = Date.now(); t.mock.method(Date, 'now', () => now);
  const sent = []; let signal;
  globalThis.fetch = (url, options) => {
    if (url.endsWith('/reset')) return Promise.resolve(new Response(null, { status: 204 }));
    sent.push(JSON.parse(options.body)); signal = options.signal;
    return new Promise(() => {});
  };
  const { ui, faces, tick } = await liveHarness();
  await faces(1); await tick(100);
  fireEvent.click(ui.getByRole('radio', { name: 'Playful' }));
  assert.equal(signal.aborted, true);
  now += 9000; await faces(1); await tick(10000); assert.equal(sent.length, 1);
  fireEvent.click(ui.getByRole('button', { name: 'Try again' }));
  await tick(11000); assert.equal(sent.length, 2); assert.equal(sent[1].settings.intensity, 'playful');
});


test('solo publication previews before explicit approval, blocks duplicate clicks, and links to voting', async () => {
  const calls = [], busy = []; let resolve;
  globalThis.fetch = (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return new Promise(r => resolve = r); };
  const ui = render(React.createElement(PublishEgo, { receipt: 'receipt-fixture', snapshot: '/9j/AA==', roast: 'A solo roast.', onBusyChange: value => busy.push(value) }));
  fireEvent.click(ui.getByRole('button', { name: 'Publish my ego' }));
  assert.ok(ui.getByRole('dialog', { name: 'Publish my ego' }));
  assert.equal(ui.queryByText('A solo roast.'),null);assert.ok(ui.getByAltText('Your roast snapshot for public sharing')); assert.equal(calls.length, 0);
  const confirm = ui.getByRole('button', { name: 'Publish to Checked Gallery' });
  assert.equal(confirm.disabled, true);
  fireEvent.click(ui.getByRole('checkbox'));
  fireEvent.click(confirm); fireEvent.click(confirm);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { url: '/api/roast/publish', body: { receipt: 'receipt-fixture', snapshot: '/9j/AA==', approved: true } });
  assert.equal(ui.getByRole('button', { name: 'Cancel' }).disabled, true);
  const photoId = '20000000-0000-4000-8000-000000000001';
  await act(async () => resolve(Response.json({ photoId })));
  const link = ui.getByRole('link', { name: 'View in Checked Gallery ↗' });
  assert.equal(link.getAttribute('href'), `/gallery?sort=newest#photo-${photoId}`);
  assert.deepEqual(busy, [true, false]);
  fireEvent.click(ui.getByRole('button', { name: 'Close' }));
  assert.equal(ui.queryByRole('dialog'), null);
  assert.equal(document.activeElement, ui.getByRole('link', { name: 'View my ego ↗' }));
});

test('cancelled public-sharing previews send nothing and failed publication can be retried', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return calls === 1 ? Response.json({ error: 'Temporary failure.' }, { status: 503 }) : Response.json({ photoId: '20000000-0000-4000-8000-000000000002' }); };
  const ui = render(React.createElement(PublishEgo, { receipt: 'receipt-fixture', snapshot: '/9j/AA==', roast: 'A solo roast.', onBusyChange: () => {} }));
  fireEvent.click(ui.getByRole('button', { name: 'Publish my ego' }));
  fireEvent.click(ui.getByRole('checkbox')); fireEvent.click(ui.getByRole('button', { name: 'Cancel' }));
  assert.equal(calls, 0);
  fireEvent.click(ui.getByRole('button', { name: 'Publish my ego' }));
  assert.equal(ui.getByRole('checkbox').checked, false);
  fireEvent.click(ui.getByRole('checkbox')); fireEvent.click(ui.getByRole('button', { name: 'Publish to Checked Gallery' }));
  await waitFor(() => assert.ok(ui.getByText('Temporary failure.')));
  fireEvent.click(ui.getByRole('button', { name: 'Publish to Checked Gallery' }));
  await waitFor(() => assert.ok(ui.getByRole('link', { name: 'View in Checked Gallery ↗' })));
  assert.equal(calls, 2);
});

test('meme generation failure offers retry without revealing the unfinished screenshot', async () => {
  const { RoastMeme } = await import('../app/you-are-a-joke/roast-meme.tsx');
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return calls.length === 1 ? Response.json({ error: 'Image provider busy.' }, { status: 503 }) : Response.json({ snapshot: 'ZmluaXNoZWQ=', receipt: 'generated-receipt' });
  };
  const ui = render(React.createElement(RoastMeme, { receipt: 'original-receipt', snapshot: '/9j/AA==', roast: 'Your punchline.', onBusyChange: () => {} }));
  await waitFor(() => assert.ok(ui.getByRole('alert')));
  assert.equal(ui.queryByAltText('The screenshot captured for your punchline'),null);
  assert.equal(ui.queryByAltText('Your checked screenshot'),null);
  assert.ok(!ui.queryByRole('button', { name: 'Publish my ego' }) || ui.getByRole('button', { name: 'Publish my ego' }).disabled);
  fireEvent.click(ui.getByRole('button', { name: 'Retry image generation' }));
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Publish my ego' })));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], { url: '/api/roast/meme', body: { receipt: 'original-receipt', snapshot: '/9j/AA==' } });
  fireEvent.click(ui.getByRole('button', { name: 'Publish my ego' }));
  assert.equal(ui.getByAltText('Your roast snapshot for public sharing').getAttribute('src'), 'data:image/webp;base64,ZmluaXNoZWQ=');
});


test('generated screenshots survive tab changes and remount without another generation or camera permission',async()=>{
 const { RoastMeme }=await import('../app/you-are-a-joke/roast-meme.tsx');
 const {readCheckedMeme}=await import('../lib/checked-meme-cache.ts');
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({snapshot:'ZmluaXNoZWQ=',receipt:'cached-receipt'});};
 const first=render(React.createElement(RoastMeme,{receipt:'input',snapshot:'/9j/AA==',roast:'Private roast',userId:'cached-user',onBusyChange:()=>{}}));
 await waitFor(()=>assert.ok(first.getByAltText('Your checked screenshot')));
 await waitFor(async()=>assert.equal((await readCheckedMeme('cached-user'))?.snapshot,'ZmluaXNoZWQ='));
 first.unmount();
 const restored=render(React.createElement(RoastStudio,{mock:false,configured:true,userId:'cached-user'}));
 await waitFor(()=>assert.equal(restored.getByAltText('Your checked screenshot').getAttribute('src'),'data:image/webp;base64,ZmluaXNoZWQ='));
 assert.equal(calls,1);assert.equal(restored.queryByText('Private roast'),null);
 Object.defineProperty(document,'hidden',{configurable:true,value:true});
 await act(async()=>document.dispatchEvent(new Event('visibilitychange')));
 Object.defineProperty(document,'hidden',{configurable:true,value:false});
 await act(async()=>document.dispatchEvent(new Event('visibilitychange')));
 assert.ok(restored.getByAltText('Your checked screenshot'));assert.equal(calls,1);
 restored.unmount();
 const other=render(React.createElement(RoastStudio,{mock:false,configured:true,userId:'other-user'}));
 await act(async()=>{});assert.equal(other.queryByAltText('Your checked screenshot'),null);
});


test('the optional Factory-style keyword is sent as the punchline direction',async()=>{
 let sent;globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);return new Promise(()=>{});};
 const ui=mount(false);const keyword=ui.getByLabelText(/Keyword/);
 fireEvent.change(keyword,{target:{value:'  Finals week  '}});
 assert.equal(keyword.maxLength,500);assert.equal(keyword.getAttribute('placeholder'),'Finals week, first dates, office life…');
 // The camera harness supplies frames; retain the keyword on the mounted studio.
 ui.unmount();
 const {ui:live,faces,tick}=await liveHarness();
 fireEvent.click(live.getByRole('button',{name:'Cancel roast'}));
 fireEvent.change(live.getByLabelText(/Keyword/),{target:{value:'  Finals week  '}});
 fireEvent.click(live.getByRole('button',{name:'Try again'}));
 await faces(1);await tick(100);
 assert.equal(sent.settings.direction,'Finals week');
});

test('Floating Evidence close button cancels without publishing and restores trigger focus',()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({});};
 const ui=render(React.createElement(PublishEgo,{receipt:'receipt-fixture',snapshot:'/9j/AA==',roast:'A solo roast.',onBusyChange:()=>{}}));
 const trigger=ui.getByRole('button',{name:'Publish my ego'});fireEvent.click(trigger);
 fireEvent.click(ui.getByRole('checkbox'));
 fireEvent.click(ui.getByRole('button',{name:'Close publish window'}));
 assert.equal(ui.queryByRole('dialog'),null);assert.equal(document.activeElement,trigger);assert.equal(calls,0);
 fireEvent.click(trigger);assert.equal(ui.getByRole('checkbox').checked,false);
 assert.equal(ui.getByRole('button',{name:'Publish to Checked Gallery'}).disabled,true);
});
