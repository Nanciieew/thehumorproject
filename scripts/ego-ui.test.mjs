import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost:3000'});
for(const name of ['window','document','HTMLElement','HTMLInputElement','MutationObserver','Node','Event','MouseEvent','getComputedStyle']) Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
globalThis.self = dom.window;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {render,fireEvent,waitFor,cleanup}=await import('@testing-library/react');
const {ChallengeCreator}=await import('../app/ego-ui.tsx');
const {BattleView}=await import('../app/challenges/[id]/view.tsx');
const {ShameBoard}=await import('../app/leaderboard/shame-board.tsx');
const originalFetch=globalThis.fetch;
afterEach(()=>{cleanup();globalThis.fetch=originalFetch;});
const battle={id:'10000000-0000-4000-8000-000000000001',creatorId:'alice',opponentId:'bob',creator:'Alice',opponent:'Bob',visibility:'public',status:'voting',endsAt:new Date(Date.now()+3600000).toISOString(),expiresAt:new Date(Date.now()+604800000).toISOString(),winner:null,creatorVotes:0,opponentVotes:0,myVote:null,entries:[{userId:'alice',roast:'Alice roast',hasMedia:false,publishedId:null},{userId:'bob',roast:'Bob roast',hasMedia:false,publishedId:null}]};
test('challenge creator discloses audience and sends a single explicit creation action',async()=>{
 const calls=[];globalThis.fetch=async(_url,options)=>{const b=JSON.parse(options.body);calls.push(b);return Response.json(b.action==='friends'?[]:{id:battle.id});};
 const ui=render(React.createElement(ChallengeCreator));
 fireEvent.click(ui.getByText('Challenge a friend'));
 fireEvent.change(ui.getByLabelText('Audience'),{target:{value:'private'}});
 fireEvent.click(ui.getByRole('button',{name:/Create challenge/}));
 await waitFor(()=>assert.ok(ui.getByText('Invite ready · expires in 7 days.')));
 assert.deepEqual(calls.find(c=>c.action==='create').data,{visibility:'private',opponent:null});
});
test('spectator votes go to the battle and never to gallery voting',async()=>{
 const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,...JSON.parse(options.body)});return Response.json(JSON.parse(options.body).action==='battle'?{...battle,myVote:'alice',creatorVotes:1}:{});};
 const ui=render(React.createElement(BattleView,{initial:battle,userId:'spectator'}));
 fireEvent.click(ui.getAllByRole('button',{name:'This one got cooked'})[0]);
 await waitFor(()=>assert.ok(ui.getByRole('button',{name:'Your verdict · undo'})));
 assert.equal(calls[0].action,'vote');assert.equal(calls[0].data.target,'alice');assert.ok(calls.every(c=>c.url==='/api/ego'));
});
test('participants cannot self-vote; public publication requires its own approval',async()=>{
 const ui=render(React.createElement(BattleView,{initial:{...battle,status:'completed',winner:'alice'},userId:'alice'}));
 assert.equal(ui.queryByRole('button',{name:'This one got cooked'}),null);
 // An expired snapshot cannot be published even if the battle was won.
 assert.equal(ui.queryByRole('button',{name:'Publish my result ↗'}),null);
 assert.ok(ui.getByText('This snapshot has expired.'));
});
test('published result and gallery counters remain separate in the rankings view',()=>{
 const ui=render(React.createElement(ShameBoard,{initial:{trackingStartedAt:new Date().toISOString(),weekly:[{id:'alice',name:'Alice',wins:2,votes:18}],monthly:[{id:'photo',title:'Evidence',name:'Bob',public_storage_path:'path',votes:4,lifetime_votes:42}]},initialError:''}));
 assert.ok(ui.getByText('Battle votes'));fireEvent.click(ui.getByRole('button',{name:'Monthly upvotes'}));assert.ok(ui.getByText('New upvotes'));assert.ok(ui.getByText('Lifetime upvotes'));assert.ok(ui.getByText('42'));
});

test('public arena previews show approved roast entries and link to the battle',async()=>{
 const {Arena}=await import('../app/challenges/arena.tsx');
 const ui=render(React.createElement(Arena,{initial:[{...battle,entries:battle.entries}],initialError:'',signedIn:false,initialScope:'public'}));
 assert.ok(ui.getByText('Alice roast'));assert.ok(ui.getByText('Bob roast'));
 assert.ok(ui.getByRole('link',{name:/Alice/}).getAttribute('href').endsWith(battle.id));
});
