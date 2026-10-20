import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime.js';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url:'http://localhost:3000/quest' });
for (const name of ['window','document','HTMLElement','MutationObserver','Node','Event','MouseEvent','getComputedStyle','localStorage','sessionStorage']) Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
globalThis.self=dom.window;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
window.matchMedia=()=>({matches:true});
const {render,fireEvent,waitFor,cleanup}=await import('@testing-library/react');
const {DailyQuest}=await import('../app/daily-quest.tsx');
const {readQuestHistory,questSummary}=await import('../lib/checkly-quest.ts');
const originalFetch=globalThis.fetch;
afterEach(()=>{cleanup();localStorage.clear();sessionStorage.clear();globalThis.fetch=originalFetch;});
const photo=id=>({id:String(id),title:`Meme ${id}`,description:'Hidden caption',photo_url:`https://example.com/${id}.png`,contributor_name:'Tester',published_at:`2026-10-19T12:00:${String(59-id).padStart(2,'0')}Z`,vote:null,upvotes:0});
function setup(count,{fail=false,pageFor}={}){
 const calls=[],requests=[];
 globalThis.fetch=async(url,options)=>{
  if(url.startsWith('/api/gallery?')){
   assert.match(url,/sort=newest/);requests.push(url);
   return pageFor? pageFor(url) : Response.json({items:Array.from({length:count},(_,i)=>photo(i)),next_cursor:null});
  }
  assert.equal(url,'/api/gallery/vote');assert.equal(options.method,'POST');
  const body=JSON.parse(options.body);calls.push(body);
  return (typeof fail==='function'?fail(calls.length):fail)?Response.json({error:'Vote failed. Try again.'},{status:503}):Response.json({vote:body.value,upvotes:body.value===1?1:0});
 };
 const ui=render(React.createElement(React.StrictMode,null,React.createElement(AppRouterContext.Provider,{value:{refresh(){}}},React.createElement(DailyQuest,{userId:'tester'}))));
 return {ui,calls,requests};
}
async function waitPhoto(ui,id){
 await waitFor(()=>{
  assert.equal(new URL(ui.getByRole('img',{name:'Meme to rate'}).getAttribute('src'),'http://localhost').pathname,`/${id}.png`);
  assert.equal(ui.getByRole('button',{name:'LOL — upvote meme'}).disabled,false);
 });
}
async function choose(ui,id,value=1){await waitPhoto(ui,id);fireEvent.click(ui.getByRole('button',{name:value===1?'LOL — upvote meme':'Meh — downvote meme'}));}

test('real votes complete ten, update history, and Keep Going advances without repeats',async()=>{
 const {ui,calls}=setup(12);
 for(let i=0;i<10;i++)await choose(ui,i);
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'Consider it checked.'})));
 assert.equal(ui.getByRole('progressbar').getAttribute('value'),'10');
 assert.equal(calls.length,10);
 assert.equal(questSummary(readQuestHistory('tester')).completedToday,true);
 assert.equal(questSummary(readQuestHistory('tester')).upvotes,10);
 fireEvent.click(ui.getByRole('button',{name:/Keep Going/}));
 await waitPhoto(ui,10);
 assert.equal(ui.getByRole('progressbar').getAttribute('value'),'0');
 assert.equal(ui.getByRole('progressbar').getAttribute('max'),'2');
 await choose(ui,10);await choose(ui,11,-1);
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'You’re all checked.'})));
 assert.equal(ui.queryByRole('button',{name:/Keep Going/}),null);
 assert.equal(new Set(calls.map(call=>call.photoId)).size,12);
 assert.equal(questSummary(readQuestHistory('tester')).downvotes,1);
 assert.ok(sessionStorage.getItem('checked:gallery-votes-changed'));
});
test('short first quests still offer Keep Going before the final all-checked screen',async()=>{
 const {ui,calls}=setup(2);
 await waitPhoto(ui,0);fireEvent.keyDown(window,{key:'ArrowRight'});
 await waitPhoto(ui,1);fireEvent.keyDown(window,{key:'ArrowLeft'});
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'Consider it checked.'})));
 assert.deepEqual(calls.map(call=>call.value),[1,-1]);
 assert.equal(questSummary(readQuestHistory('tester')).completedToday,true);
 assert.equal(ui.queryByRole('heading',{name:'You’re all checked.'}),null);
 fireEvent.click(ui.getByRole('button',{name:/Keep Going/}));
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'You’re all checked.'})));
 assert.equal(calls.length,2);
});
test('a failed vote preserves the meme and counter; retry saves it exactly once',async()=>{
 const {ui,calls}=setup(2,{fail:attempt=>attempt===1});
 await choose(ui,0);
 await waitFor(()=>assert.ok(ui.getByRole('alert')));
 await waitPhoto(ui,0);
 assert.equal(ui.getByRole('progressbar').getAttribute('value'),'0');
 assert.equal(questSummary(readQuestHistory('tester')).upvotes,0);
 assert.equal(questSummary(readQuestHistory('tester')).completedToday,false);
 await choose(ui,0);await waitPhoto(ui,1);
 assert.equal(ui.getByRole('progressbar').getAttribute('value'),'1');
 assert.equal(questSummary(readQuestHistory('tester')).upvotes,1);
 assert.equal(calls.length,2);
});
test('meme cards contain only the image, with no creator, headline, or caption',async()=>{
 const {ui}=setup(2);await waitPhoto(ui,0);
 assert.equal(ui.getByRole('article').querySelectorAll('img').length,1);
 assert.equal(ui.queryByText('Meme 0'),null);
 assert.equal(ui.queryByText(/Tester/),null);
 assert.equal(ui.queryByText('Hidden caption'),null);
 assert.equal(ui.queryByText('Vote on up to 10 memes'),null);
});
test('empty feeds offer the dashboard without falsely completing the daily quest',async()=>{
 const {ui,calls}=setup(0);
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'You’re all checked.'})));
 assert.equal(ui.getByRole('link',{name:/Back to Gallery/}).getAttribute('href'),'/gallery');
 assert.equal(ui.queryByRole('progressbar'),null);
 assert.equal(questSummary(readQuestHistory('tester')).completedToday,false);
 assert.equal(calls.length,0);
});
test('horizontal swipes save opposite votes and vertical scrolling never votes',async()=>{
 const {ui,calls}=setup(2);await waitPhoto(ui,0);
 const swipe=(dx,dy)=>{
  const card=ui.getByRole('article');card.setPointerCapture=()=>{};
  for(const [type,x,y] of [['pointerdown',100,100],['pointerup',100+dx,100+dy]]){
   const event=new Event(type,{bubbles:true});
   for(const [name,value] of Object.entries({pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y}))Object.defineProperty(event,name,{value});
   fireEvent(card,event);
  }
 };
 swipe(10,100);assert.equal(calls.length,0);swipe(100,5);
 await waitPhoto(ui,1);swipe(-100,5);
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'Consider it checked.'})));
 assert.deepEqual(calls.map(call=>call.value),[1,-1]);
});
test('daily progress survives remounting and skips previously rated memes',async()=>{
 const {ui}=setup(2);await choose(ui,0);await waitPhoto(ui,1);ui.unmount();
 const resumed=setup(2).ui;await waitPhoto(resumed,1);
 assert.equal(resumed.getByRole('progressbar').getAttribute('value'),'1');
});
test('repeated clicks and arrow keys while saving produce only one vote',async()=>{
 const {ui,calls}=setup(3);await waitPhoto(ui,0);
 const right=ui.getByRole('button',{name:'LOL — upvote meme'});
 fireEvent.click(right);assert.equal(right.disabled,true);fireEvent.click(right);fireEvent.keyDown(window,{key:'ArrowRight'});
 await waitPhoto(ui,1);assert.equal(calls.length,1);
 assert.equal(ui.getByRole('progressbar').getAttribute('value'),'1');
});
test('pagination is newest-first and duplicate feed entries never repeat a vote',async()=>{
 const {ui,calls,requests}=setup(0,{pageFor:url=>Response.json(new URL(url,'http://localhost').searchParams.has('cursor')?{items:[photo(9),photo(10),photo(11)],next_cursor:null}:{items:Array.from({length:10},(_,i)=>photo(9-i)),next_cursor:'older'})});
 for(let i=0;i<10;i++)await choose(ui,i);
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'Consider it checked.'})));
 fireEvent.click(ui.getByRole('button',{name:/Keep Going/}));await choose(ui,10);await choose(ui,11);
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'You’re all checked.'})));
 assert.deepEqual(calls.map(call=>call.photoId),Array.from({length:12},(_,i)=>String(i)));
 assert.equal(requests.length,2);assert.match(requests[1],/cursor=older/);
});
test('after continuing, the final tenth vote goes straight to all checked',async()=>{
 const {ui}=setup(20);
 for(let i=0;i<20;i++){
  await choose(ui,i);
  if(i===9){await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'Consider it checked.'})));fireEvent.click(ui.getByRole('button',{name:/Keep Going/}));}
 }
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'You’re all checked.'})));
 assert.equal(ui.queryByRole('button',{name:/Keep Going/}),null);
 ui.unmount();
 const resumed=setup(20).ui;
 await waitFor(()=>assert.ok(resumed.getByRole('heading',{name:'You’re all checked.'})));
});
