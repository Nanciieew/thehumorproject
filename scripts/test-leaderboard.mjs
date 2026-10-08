// Start the app on localhost:3000, then: node --env-file=.env.local scripts/test-leaderboard.mjs
// Creates only temporary users/images, never sale records; cleans up every fixture.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
const base=process.env.LEADERBOARD_TEST_URL ?? 'http://localhost:3000';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const anon=createClient(url,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[];
const check=result=>{assert.ifError(result.error);return result.data;};
async function user(complete){
 const email=`leaderboard-test-${randomUUID()}@example.com`;const password=randomUUID()+randomUUID();
 const created=check(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
 const actor={id:created.id};users.push(actor);const jar=new Map();
 actor.client=createServerClient(url,process.env.SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
 check(await actor.client.auth.signInWithPassword({email,password}));actor.cookie=()=>[...jar].map(([name,value])=>`${name}=${value}`).join('; ');
 check(await admin.from('profiles').insert({id:actor.id,first_name:'Leaderboard',last_name:'Fixture',state_code:'TX',onboarding_completed_at:complete?new Date().toISOString():null}));return actor;
}
const request=(query,actor)=>fetch(`${base}/api/leaderboard${query}`,{headers:actor?{cookie:actor.cookie()}:undefined});
try{
 check(await admin.from('image_sales').select('id').limit(1));
 const owner=await user(true);const pending=await user(false);
 const image=randomUUID();const draft=randomUUID();
 check(await admin.from('images').insert([
  {id:image,contributor_id:owner.id,source:'upload',title:'',public_storage_path:`${owner.id}/${image}.webp`,published_at:new Date().toISOString()},
  {id:draft,contributor_id:owner.id,source:'generated',private_storage_path:`${owner.id}/${draft}.webp`,title:'PRIVATE LEADERBOARD FIXTURE'},
 ]));
 assert.equal((await request('')).status,401);assert.equal((await request('',pending)).status,401);
 assert.equal((await request('?period=bad',owner)).status,400);assert.equal((await request('?cursor=bad',owner)).status,400);
 const pageResponse=await fetch(`${base}/leaderboard`,{headers:{cookie:owner.cookie()}});
 assert.equal(pageResponse.status,200);const html=await pageResponse.text();
 for(const title of ['Creator rankings','Monthly rewards','Top avatars','Top states','Leaderboard Fixture']) assert.ok(html.includes(title),`Missing live page content: ${title}`);
 assert.ok(!html.includes('PRIVATE LEADERBOARD FIXTURE'));assert.ok(!html.includes('COMING SOON'));
 const monthlyResponse=await request('?period=monthly',owner);assert.equal(monthlyResponse.status,200);assert.equal(monthlyResponse.headers.get('cache-control'),'private, no-store');
 const monthly=await monthlyResponse.json();const allResponse=await request('?period=all_time',owner);assert.equal(allResponse.status,200);const all=await allResponse.json();
 const row=monthly.individuals.find(x=>x.contributor_id===owner.id);assert.ok(row);assert.equal(row.avatars_made,1);assert.equal(row.revenue_cents,'0');assert.equal(row.name,'Leaderboard Fixture');assert.equal(row.profile_photo_url,null);
 assert.ok(!JSON.stringify(monthly).includes('PRIVATE LEADERBOARD FIXTURE'));
 assert.ok(!JSON.stringify(monthly).includes('avatar_path'));assert.ok(!JSON.stringify(monthly).includes('private_storage_path'));
 assert.equal(all.period,'all_time');assert.deepEqual(all.monthly_rewards,monthly.monthly_rewards);assert.deepEqual(all.monthly_top_regions,monthly.monthly_top_regions);
 assert.ok((await anon.from('image_sales').select('*')).error);assert.ok((await owner.client.from('image_sales').select('*')).error);
 assert.ok((await owner.client.rpc('leaderboard_summary',{p_period:'monthly'})).error);
 assert.ok((await owner.client.rpc('record_image_sale',{p_image_id:image,p_amount_cents:100,p_reference:randomUUID()})).error);
 const summary=check(await admin.rpc('leaderboard_summary',{p_period:'monthly'}));assert.ok(summary.individuals.some(x=>x.contributor_id===owner.id));
 const dashboardRequest=actor=>fetch(`${base}/api/dashboard`,{headers:actor?{cookie:actor.cookie()}:undefined});
 assert.equal((await dashboardRequest()).status,401);assert.equal((await dashboardRequest(pending)).status,401);
 const dashboardResponse=await dashboardRequest(owner);assert.equal(dashboardResponse.status,200);assert.equal(dashboardResponse.headers.get('cache-control'),'private, no-store');
 assert.deepEqual(await dashboardResponse.json(),{published_count:'1',upvotes:'0',revenue_cents:'0'});
 const isolated=await fetch(`${base}/api/dashboard?contributor_id=${pending.id}`,{headers:{cookie:owner.cookie()}});
 assert.deepEqual(await isolated.json(),{published_count:'1',upvotes:'0',revenue_cents:'0'});
 check(await admin.from('images').delete().eq('id',draft));
 const dashboardPage=await fetch(`${base}/my-works`,{headers:{cookie:owner.cookie()}});assert.equal(dashboardPage.status,200);
 const dashboardHtml=await dashboardPage.text();
 for(const title of ['My Dashboard','Revenue earned','Upvotes received','Avatars published','Your works']) assert.ok(dashboardHtml.includes(title),`Missing dashboard content: ${title}`);
 assert.ok(!dashboardHtml.includes('Couldn’t load your dashboard totals'));
 console.log('PASS: personal dashboard page, owner-only totals, guest/pending rejection, private drafts excluded, query parameters cannot change owner.');
 console.log('PASS: authenticated endpoint, guest/pending rejection, period/cursor validation, private drafts excluded, names/photos/rewards, service-only sales and aggregates.');
}finally{
 for(const actor of users){check(await admin.from('images').delete().eq('contributor_id',actor.id));check(await admin.auth.admin.deleteUser(actor.id));}
 console.log('Removed all temporary leaderboard fixtures.');
}
