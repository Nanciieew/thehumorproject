import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime.js';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:3000' });
for (const name of ['window','document','HTMLElement','MutationObserver','Node','Event','MouseEvent','getComputedStyle','localStorage']) Object.defineProperty(globalThis, name, { configurable:true, value:dom.window[name] });
globalThis.self = dom.window;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/react');
const { DailyQuest } = await import('../app/daily-quest.tsx');
const { readQuestHistory, questSummary } = await import('../lib/checkly-quest.ts');
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); localStorage.clear(); globalThis.fetch = originalFetch; });
const photo = id => ({ id:String(id), title:`Meme ${id}`, photo_url:`https://example.com/${id}.png`, contributor_name:'Tester', published_at:`2026-10-19T12:00:${String(59-id).padStart(2,'0')}Z`, vote:null, upvotes:0 });
function setup(count, { fail = false } = {}) {
 const calls = [];
 globalThis.fetch = async (url, options) => {
  if (url.startsWith('/api/gallery?')) { assert.match(url, /sort=newest/); return Response.json({ items:Array.from({length:count}, (_, i) => photo(i)), next_cursor:null }); }
  const body = JSON.parse(options.body); calls.push(body);
  return fail ? Response.json({error:'Vote failed. Try again.'}, {status:503}) : Response.json({vote:body.value,upvotes:body.value === 1 ? 1 : 0});
 };
 const ui = render(React.createElement(AppRouterContext.Provider, { value:{refresh(){}} }, React.createElement(DailyQuest, {userId:'tester'})));
 return {ui,calls};
}
test('ten successful votes complete a quest; keep going starts the remaining memes', async () => {
 const {ui,calls} = setup(12);
 for (let i=0; i<10; i++) {
  await waitFor(() => assert.ok(ui.getByRole('heading', {name:`Meme ${i}`,exact:true})));
  fireEvent.click(ui.getByRole('button',{name:'↑ Upvote'}));
 }
 await waitFor(() => assert.ok(ui.getByRole('heading',{name:/Congrats/})));
 assert.equal(calls.length,10);
 assert.equal(questSummary(readQuestHistory("tester")).completedToday,true);
 assert.equal(questSummary(readQuestHistory("tester")).upvotes,10);
 assert.ok(calls.every(call => call.value === 1));
 fireEvent.click(ui.getByRole('button',{name:'Keep on going'}));
 await waitFor(() => assert.ok(ui.getByRole('heading',{name:'Meme 10',exact:true})));
 assert.ok(ui.getByText('0 / 2 rated'));
});
test('short quests finish after all available memes and do not repeat them', async () => {
 const {ui,calls} = setup(2);
 await waitFor(() => assert.ok(ui.getByText('0 / 2 rated')));
 fireEvent.keyDown(window,{key:'ArrowRight'});
 await waitFor(() => assert.ok(ui.getByRole('heading',{name:'Meme 1',exact:true})));
 fireEvent.keyDown(window,{key:'ArrowLeft'});
 await waitFor(() => assert.ok(ui.getByRole('heading',{name:/Congrats/})));
 assert.deepEqual(calls.map(call => call.value),[1,-1]);
 assert.equal(questSummary(readQuestHistory("tester")).completedToday,true);
 fireEvent.click(ui.getByRole('button',{name:'Keep on going'}));
 await waitFor(() => assert.ok(ui.getByRole('heading',{name:'No more memes just yet.'})));
 assert.equal(calls.length,2);
});
test('failed votes leave the same meme and progress available for retry', async () => {
 const {ui,calls} = setup(2,{fail:true});
 await waitFor(() => assert.ok(ui.getByRole('heading',{name:'Meme 0',exact:true})));
 fireEvent.click(ui.getByRole('button',{name:'↑ Upvote'}));
 await waitFor(() => assert.ok(ui.getByRole('alert')));
 assert.ok(ui.getByText('0 / 2 rated'));
 assert.ok(ui.getByRole('heading',{name:'Meme 0',exact:true}));
 assert.equal(calls.length,1);
 assert.equal(questSummary(readQuestHistory("tester")).upvotes,0);
 assert.equal(questSummary(readQuestHistory("tester")).completedToday,false);
});
test('left and right arrow buttons persist opposite vote values', async () => {
 const {ui,calls} = setup(2);
 await waitFor(() => assert.ok(ui.getByRole('heading',{name:'Meme 0',exact:true})));
 fireEvent.click(ui.getByRole('button',{name:'Swipe left to downvote'}));
 await waitFor(() => assert.ok(ui.getByRole('heading',{name:'Meme 1',exact:true})));
 fireEvent.click(ui.getByRole('button',{name:'Swipe right to upvote'}));
 await waitFor(() => assert.ok(ui.getByRole('heading',{name:/Congrats/})));
 assert.deepEqual(calls.map(call=>call.value),[-1,1]);
});
test('empty feeds offer a refresh and gallery link without a false completion', async () => {
 const {ui} = setup(0);
 await waitFor(() => assert.ok(ui.getByRole('heading',{name:'No more memes just yet.'})));
 assert.equal(ui.queryByRole('heading',{name:/Congrats/}),null);
 assert.equal(ui.getByRole('link',{name:/Checked Gallery/}).getAttribute('href'),'/gallery');
});
test('horizontal swipes save votes and vertical gestures do not', async () => {
 const {ui,calls} = setup(2);
 await waitFor(() => assert.ok(ui.getByRole('heading',{name:'Meme 0',exact:true})));
 const swipe = (dx,dy) => {
  const card = ui.getByRole('article'); card.setPointerCapture = () => {};
  for (const [type,x,y] of [['pointerdown',100,100],['pointerup',100+dx,100+dy]]) {
   const event = new Event(type,{bubbles:true});
   for (const [name,value] of Object.entries({pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y})) Object.defineProperty(event,name,{value});
   fireEvent(card,event);
  }
 };
 swipe(10,100); assert.equal(calls.length,0);
 swipe(100,5);
 await waitFor(() => assert.ok(ui.getByRole('heading',{name:'Meme 1',exact:true})));
 swipe(-100,5);
 await waitFor(() => assert.ok(ui.getByRole('heading',{name:/Congrats/})));
 assert.deepEqual(calls.map(call=>call.value),[1,-1]);
});
test('daily progress survives remounting without repeating the voted meme', async () => {
 const {ui} = setup(2);
 await waitFor(() => assert.ok(ui.getByRole('heading',{name:'Meme 0',exact:true})));
 fireEvent.click(ui.getByRole('button',{name:'↑ Upvote'}));
 await waitFor(() => assert.ok(ui.getByRole('heading',{name:'Meme 1',exact:true})));
 ui.unmount();
 const resumed = setup(2).ui;
 await waitFor(() => assert.ok(resumed.getByRole('heading',{name:'Meme 1',exact:true})));
 assert.ok(resumed.getByText('1 / 2 rated'));
});
