// Uses disposable accounts and synthetic snapshots, never a real webcam or Gemini generation.
// node --conditions=react-server --env-file=.env.local --import tsx scripts/test-ego-live.mjs
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import sharp from 'sharp';
import {signReceipt} from '../lib/roast/receipt.ts';
const base=process.env.EGO_TEST_URL??'http://localhost:3000';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[],paths=[],publicPaths=[];
const check=r=>{assert.ifError(r.error);return r.data;};
async function actor(name){
 const email=`ego-fixture-${randomUUID()}@example.com`,password=randomUUID()+randomUUID();
 const user=check(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
 const jar=new Map();const a={id:user.id};users.push(a);
 a.client=createServerClient(url,process.env.SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
 check(await a.client.auth.signInWithPassword({email,password}));a.cookie=()=>[...jar].map(([name,value])=>`${name}=${value}`).join('; ');
 check(await admin.from('profiles').insert({id:a.id,first_name:name,last_name:'Ego Fixture',state_code:'NY',onboarding_completed_at:new Date().toISOString()}));return a;
}
async function request(path,a,body){return fetch(base+path,{method:body?'POST':'GET',headers:{origin:base,'Content-Type':'application/json',...(a?{cookie:a.cookie()}: {})},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual'});}
async function action(a,command,data={}){const r=await request('/api/ego',a,{action:command,data});assert.equal(r.status,200,`${command}: ${await r.clone().text()}`);return r.json();}
try{
 // Abort before fixtures when the schema is unavailable.
 check(await admin.rpc('ego_action',{p_action:'rankings',p_data:{}}));
 const actors=[];for(const name of ['Alice','Bob','Spectator1','Spectator2','Spectator3'])actors.push(await actor(name));
 const [a,b,v1,v2,v3]=actors;
 await action(a,'friend_request',{userId:b.id});const friendship=(await action(b,'friends')).find(f=>f.user_id===a.id);await action(b,'friend_accept',{id:friendship.id});
 const {id}=await action(a,'create',{opponent:b.id,visibility:'public'});await action(b,'accept',{id});
 const snapshot=(await sharp({create:{width:32,height:24,channels:3,background:'#dde323'}}).jpeg().toBuffer()).toString('base64');
 for(const person of[a,b]){
  paths.push(`${person.id}/${id}.webp`);
  const r=await request(`/api/challenges/${id}/entry`,person,{approved:true,receipt:signReceipt(person.id,`${person===a?'Alice':'Bob'} fixture roast.`,snapshot),snapshot});assert.equal(r.status,200);
 }
 assert.equal((await action(a,'battle',{id})).status,'voting');
 assert.equal((await request(`/api/challenges/${id}/media/${a.id}`,null)).status,200);
 const self=await request('/api/ego',a,{action:'vote',data:{id,target:a.id}});assert.equal(self.status,400);
 for(const spectator of[v1,v2,v3])await action(spectator,'vote',{id,target:a.id});
 check(await admin.from('ego_challenges').update({voting_ends_at:new Date(Date.now()-1000).toISOString()}).eq('id',id));
 const final=await action(v1,'battle',{id});assert.equal(final.winner,a.id);assert.equal(final.creatorVotes,3);
 publicPaths.push(`${a.id}/challenge-${id}.webp`);
 const published=await request(`/api/challenges/${id}/publish`,a,{approved:true});assert.equal(published.status,200);const {imageId}=await published.json();
 const vote=await request('/api/gallery/vote',v1,{photoId:imageId,value:1});assert.equal(vote.status,200);
 assert.equal((await action(a,'battle',{id})).creatorVotes,3);
 const rank=await action(v1,'rankings');assert.ok(rank.weekly.some(p=>p.id===a.id&&p.wins===1));assert.ok(rank.monthly.some(p=>p.id===imageId&&p.votes===1));
 assert.equal((await request(`/api/challenges/${id}/publish`,a,{unpublish:true})).status,200);
 const soloBody={approved:true,receipt:signReceipt(a.id,'Standalone fixture roast.',snapshot),snapshot};
 const beforeSolo=await action(a,'summary');
 assert.equal((await request('/api/roast/publish',null,soloBody)).status,401);
 assert.equal((await request('/api/roast/publish',a,{...soloBody,approved:false})).status,400);
 assert.equal((await request('/api/roast/publish',b,soloBody)).status,400);
 const soloResponses=await Promise.all([request('/api/roast/publish',a,soloBody),request('/api/roast/publish',a,soloBody)]);
 for(const r of soloResponses)assert.equal(r.status,200,await r.clone().text());
 const soloIds=await Promise.all(soloResponses.map(r=>r.json()));assert.equal(soloIds[0].photoId,soloIds[1].photoId);
 const soloId=soloIds[0].photoId;
 const soloRow=check(await admin.from('images').select('description,public_storage_path').eq('id',soloId).single());publicPaths.push(soloRow.public_storage_path);
 assert.equal(soloRow.description,'Standalone fixture roast.');
 const feedResponse=await request('/api/gallery?sort=newest',null);assert.equal(feedResponse.status,200);
 const soloCard=(await feedResponse.json()).items.find(p=>p.id===soloId);assert.ok(soloCard);assert.equal(soloCard.upvotes,0);assert.equal(soloCard.description,'Standalone fixture roast.');
 const soloVote=await request('/api/gallery/vote',v1,{photoId:soloId,value:1});assert.equal(soloVote.status,200);assert.equal((await soloVote.json()).upvotes,1);
 assert.equal((await action(a,'summary')).active,beforeSolo.active,'solo publication must not create a battle');
 console.log('PASS: solo roast approval, receipt ownership, concurrent idempotency, public gallery display, voting and independent battle totals.');
 console.log('PASS: friend acceptance, approved entries, authorized media, spectator voting, finalization, publication, independent gallery votes and rankings.');
}finally{
 if(paths.length)await admin.storage.from('challenge-entries').remove(paths);
 for(const a of users){const listed=await admin.storage.from('gallery-photos').list(a.id,{limit:100});if(!listed.error)for(const file of listed.data)publicPaths.push(`${a.id}/${file.name}`);}
 if(publicPaths.length)check(await admin.storage.from('gallery-photos').remove([...new Set(publicPaths)]));
 for(const a of users)check(await admin.auth.admin.deleteUser(a.id));
}
