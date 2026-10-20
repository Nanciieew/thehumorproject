import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost:3000/quest/preview'});
for(const name of ['window','document','HTMLElement','MutationObserver','Node','Event','MouseEvent','getComputedStyle']) Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
globalThis.self=dom.window;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
window.matchMedia=()=>({matches:true});
const {render,fireEvent,waitFor,cleanup}=await import('@testing-library/react');
const {QuestPreview}=await import('../app/quest/preview/quest-preview.tsx');
const originalFetch=globalThis.fetch;
afterEach(()=>{cleanup();globalThis.fetch=originalFetch;});
const photo=i=>({id:`meme-${i}`,photo_url:`/meme-${i}.png`,published_at:`2026-10-20T12:00:${String(59-i).padStart(2,'0')}Z`});
const renderPreview=()=>render(React.createElement(React.StrictMode,null,React.createElement(QuestPreview)));

test('newest first, paginated Keep Going never repeats a meme, and exhaustion gets its own screen',async()=>{
 const requests=[];
 globalThis.fetch=async(url,options)=>{
  assert.ok(!options.method || options.method==='GET');
  const query=new URL(url,'http://localhost').searchParams;
  assert.equal(query.get('sort'),'newest');requests.push(query.get('cursor'));
  return Response.json(query.has('cursor')?{items:[photo(9),photo(10),photo(11)],next_cursor:null}:{items:Array.from({length:10},(_,i)=>photo(9-i)),next_cursor:'older'});
 };
 const ui=renderPreview();
 const seen=[];
 const choose=async i=>{
  await waitFor(()=>assert.equal(new URL(ui.getByRole('img',{name:'Meme to rate'}).getAttribute('src'),'http://localhost').pathname,`/meme-${i}.png`));
  seen.push(ui.getByRole('img',{name:'Meme to rate'}).getAttribute('src'));
  fireEvent.click(ui.getByRole('button',{name:'LOL — upvote meme'}));
 };
 for(let i=0;i<10;i++)await choose(i);
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'Consider it checked.'})));
 assert.equal(ui.getByRole('progressbar').getAttribute('value'),'10');
 fireEvent.click(ui.getByRole('button',{name:/Keep Going/}));
 await choose(10);await choose(11);
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'You’re all checked.'})));
 assert.equal(ui.queryByRole('button',{name:/Keep Going/}),null);
 assert.equal(ui.getByRole('link',{name:/Back to Dashboard/}).getAttribute('href'),'/my-works');
 assert.equal(new Set(seen).size,12);
 assert.deepEqual(requests,[null,'older']);
});
test('empty galleries show all checked without a sample meme or fictional votes',async()=>{
 globalThis.fetch=async()=>Response.json({items:[],next_cursor:null});
 const ui=renderPreview();
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'You’re all checked.'})));
 assert.equal(ui.queryByRole('img',{name:'Meme to rate'}),null);
 assert.equal(ui.queryByRole('progressbar'),null);
});
test('a failed page is retryable and is never presented as exhaustion',async()=>{
 let attempts=0;
 globalThis.fetch=async()=>++attempts===1?Response.json({error:'Temporary interruption'},{status:503}):Response.json({items:[photo(0)],next_cursor:null});
 const ui=renderPreview();
 await waitFor(()=>assert.ok(ui.getByRole('alert')));
 assert.equal(ui.queryByRole('heading',{name:'You’re all checked.'}),null);
 fireEvent.click(ui.getByRole('button',{name:'Try again'}));
 await waitFor(()=>assert.equal(new URL(ui.getByRole('img',{name:'Meme to rate'}).getAttribute('src'),'http://localhost').pathname,'/meme-0.png'));
});

test('Keep Going after the last full batch shows all checked instead of restarting',async()=>{
 globalThis.fetch=async()=>Response.json({items:Array.from({length:10},(_,i)=>photo(i)),next_cursor:null});
 const ui=renderPreview();
 for(let i=0;i<10;i++){
  await waitFor(()=>assert.match(ui.getByRole('img',{name:'Meme to rate'}).getAttribute('src'),new RegExp(`meme-${i}\\.png$`)));
  fireEvent.click(ui.getByRole('button',{name:'LOL — upvote meme'}));
 }
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'Consider it checked.'})));
 fireEvent.click(ui.getByRole('button',{name:/Keep Going/}));
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'You’re all checked.'})));
 assert.equal(ui.queryByRole('img',{name:'Meme to rate'}),null);
});

test('the initial short quest keeps Keep Going until clicked, then shows all checked',async()=>{
 globalThis.fetch=async()=>Response.json({items:[photo(0),photo(1)],next_cursor:null});
 const ui=renderPreview();
 for(let i=0;i<2;i++){
  await waitFor(()=>assert.match(ui.getByRole('img',{name:'Meme to rate'}).getAttribute('src'),new RegExp(`meme-${i}\\.png$`)));
  fireEvent.click(ui.getByRole('button',{name:'LOL — upvote meme'}));
 }
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'Consider it checked.'})));
 assert.equal(ui.queryByRole('heading',{name:'You’re all checked.'}),null);
 assert.ok(ui.getByRole('button',{name:/Keep Going/}));
 fireEvent.click(ui.getByRole('button',{name:/Keep Going/}));
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'You’re all checked.'})));
});
test('after continuing, the final swipe goes directly to all checked even on vote ten',async()=>{
 globalThis.fetch=async()=>Response.json({items:Array.from({length:20},(_,i)=>photo(i)),next_cursor:null});
 const ui=renderPreview();
 for(let i=0;i<20;i++){
  await waitFor(()=>assert.match(ui.getByRole('img',{name:'Meme to rate'}).getAttribute('src'),new RegExp(`meme-${i}\\.png$`)));
  fireEvent.click(ui.getByRole('button',{name:'LOL — upvote meme'}));
  if(i===9){
   await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'Consider it checked.'})));
   fireEvent.click(ui.getByRole('button',{name:/Keep Going/}));
  }
 }
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'You’re all checked.'})));
 assert.equal(ui.queryByRole('button',{name:/Keep Going/}),null);
});
