import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const sql = async (s,p=[]) => (await db.query(s,p)).rows;
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create schema storage;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function storage.foldername(text) returns text[] language sql immutable as
    $$ select string_to_array($1, '/') $$;
  create table auth.users(id uuid primary key, raw_user_meta_data jsonb, last_sign_in_at timestamptz);
  create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(bucket_id text, name text);
  alter table storage.objects enable row level security;
`);
for (const name of [
  '20260930000000_create_profiles_on_first_sign_in', '20260930000001_add_profile_names',
  '20260930000002_remove_profile_display_name', '20261001000000_add_profile_photos',
  '20261006000000_add_profile_state_onboarding', '20261007000000_create_profiles_after_onboarding',
  '20261007000001_avatar_gallery', '20261007000002_my_works',
'20261007000003_consolidate_images','20261007000004_remove_legacy_image_tables','20261007000005_remove_avatar','20261007000006_gallery_publication_order','20261007000007_remove_my_works_view','20261008000000_sales_leaderboard','20261008000001_personal_dashboard','20261014000000_ego_check',
]) await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8'));

after(()=>db.close());
const users = Array.from({length:6},(_,i)=>`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
for (const [i,id] of users.entries()) { await sql('insert into auth.users(id) values($1)',[id]); await sql("insert into profiles(id,first_name,last_name,state_code,onboarding_completed_at) values($1,$2,'Person','NY',now())",[id,`Test${i}`]); }
async function as(user,action,data={}) {
 await db.exec('set role authenticated'); await sql("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 try { return (await sql('select ego_action($1,$2::jsonb) as result',[action,JSON.stringify(data)]))[0].result; }
 finally { await db.exec('reset role'); }
}
const [a,b,v1,v2,v3,outsider]=users;
let battle;
test('friend requests are unique, recipient-approved and removable',async()=>{
 await as(a,'friend_request',{userId:b}); await as(a,'friend_request',{userId:b});
 const friends=await as(b,'friends'); assert.equal(friends.length,1); assert.equal(friends[0].incoming,true);
 await assert.rejects(as(a,'friend_accept',{id:friends[0].id})); await as(b,'friend_accept',{id:friends[0].id});
 assert.equal((await as(a,'friends'))[0].status,'accepted');
});
test('acceptance is exclusive and private preparing entries cannot leak',async()=>{
 battle=(await as(a,'create',{visibility:'public',opponent:b})).id;
 await assert.rejects(as(outsider,'accept',{id:battle})); await as(b,'accept',{id:battle});
 await assert.rejects(as(outsider,'battle',{id:battle}));
 await assert.rejects(as(b,'accept',{id:battle}));
 await assert.rejects(as(outsider,'cancel',{id:battle}));
 await assert.rejects(as(a,'entry',{id:battle,roast:'fake',path:'fake'}));
 for(const u of [a,b]) await sql("select ego_server_action($1,'entry',$2::jsonb)",[u,JSON.stringify({id:battle,receipt:`${u}-${battle}`,roast:'A verified roast',path:`${u}/${battle}.webp`})]);
 assert.equal((await as(v1,'battle',{id:battle})).status,'voting');
});
test('votes are unique, changeable, nonparticipant-only and cannot extend the deadline',async()=>{
 await assert.rejects(as(a,'vote',{id:battle,target:a}));
 for(const u of [v1,v2,v3]) await as(u,'vote',{id:battle,target:a});
 await as(v1,'vote',{id:battle,target:b}); await as(v1,'vote',{id:battle,target:a});
 assert.equal((await as(v1,'battle',{id:battle})).creatorVotes,3);
 await sql("update ego_challenges set voting_ends_at=now()-interval '1 second' where id=$1",[battle]);
 // Even if a write fails, the next read finalizes the expired round.
 await assert.rejects(as(v1,'vote',{id:battle,target:b}));
 const result=await as(v1,'battle',{id:battle}); assert.equal(result.status,'completed'); assert.equal(result.winner,a);
 const rank=await as(v1,'rankings'); assert.equal(rank.weekly[0].wins,1);
});
test('publication is owner-only, idempotent and starts with zero gallery votes',async()=>{
 await assert.rejects(sql("select ego_server_action($1,'publish',$2::jsonb)",[outsider,JSON.stringify({id:battle})]));
 const p=(await sql("select ego_server_action($1,'publish',$2::jsonb) x",[a,JSON.stringify({id:battle})]))[0].x;
 const again=(await sql("select ego_server_action($1,'publish',$2::jsonb) x",[a,JSON.stringify({id:battle})]))[0].x;
 assert.equal(p.imageId,again.imageId);
 assert.equal((await sql('select upvotes from gallery_vote_totals where photo_id=$1',[p.imageId]))[0].upvotes,0);
 await as(v1,'gallery_metadata',{ids:[p.imageId]});
 await db.exec('set role authenticated'); await sql("select set_config('request.jwt.claim.sub',$1,false)",[v1]);
 try { for(const val of [1,-1,1]) await sql('select set_photo_vote($1,$2::smallint)',[p.imageId,val]); } finally { await db.exec('reset role'); }
 const rank=await as(v1,'rankings'); assert.equal(rank.monthly[0].votes,1); assert.equal(rank.weekly[0].wins,1);
});
test('shared roast leases reject overlap and reset invalidates late output',async()=>{
 const token='30000000-0000-4000-8000-000000000001';
 const call=async mode=>(await sql('select ego_roast_lock($1,$2,$3,$4,null) x',[a,'session',token,mode]))[0].x;
 assert.deepEqual(await call('acquire'),{jokes:[]}); assert.equal(await call('acquire'),null);
 await call('reset'); assert.equal((await call('finish')).current,false);
});

test('friends-only media requires a live friendship; direct table reads are denied',async()=>{
 await as(a,'friend_request',{userId:v1});const req=(await as(v1,'friends')).find(f=>f.user_id===a);await as(v1,'friend_accept',{id:req.id});
 const id=(await as(a,'create',{visibility:'friends',opponent:b})).id;await as(b,'accept',{id});
 for(const u of[a,b])await sql("select ego_server_action($1,'entry',$2::jsonb)",[u,JSON.stringify({id,receipt:`${u}-${id}`,roast:'Friend-only evidence',path:`${u}/${id}.webp`})]);
 assert.equal((await as(v1,'battle',{id})).visibility,'friends');
 await assert.rejects(as(outsider,'battle',{id}));
 const media=async user=>(await sql("select ego_server_action($1,'media',$2::jsonb) x",[user,JSON.stringify({id,userId:a})]))[0].x;
 assert.ok((await media(v1)).path);await as(v1,'friend_remove',{id:req.id});await assert.rejects(media(v1));
 await db.exec('set role authenticated');try{await assert.rejects(sql('select * from ego_entries'));await assert.rejects(sql('select * from ego_votes'));}finally{await db.exec('reset role');}
});
test('private exchanges never open voting or count wins, and snapshots expire independently of cron',async()=>{
 const id=(await as(a,'create',{visibility:'private',opponent:b})).id;await as(b,'accept',{id});
 for(const u of[a,b])await sql("select ego_server_action($1,'entry',$2::jsonb)",[u,JSON.stringify({id,receipt:`${u}-${id}`,roast:'Private evidence',path:`${u}/${id}.webp`})]);
 const result=await as(a,'battle',{id});assert.equal(result.status,'completed');assert.equal(result.winner,null);assert.equal(result.endsAt,null);
 await assert.rejects(as(v1,'vote',{id,target:a}));await assert.rejects(as(v1,'battle',{id}));
 await sql("update ego_challenges set completed_at=now()-interval '8 days' where ego_challenges.id=$1",[id]);
 const expired=await as(a,'battle',{id});assert.ok(expired.entries.every(e=>e.roast===null&&!e.hasMedia));
 await assert.rejects(sql("select ego_server_action($1,'media',$2::jsonb)",[a,JSON.stringify({id,userId:a})]));
 const queue=(await sql('select ego_maintenance() x'))[0].x;assert.ok(queue.includes(`${a}/${id}.webp`));
 const retry=(await sql('select ego_maintenance() x'))[0].x;assert.ok(retry.includes(`${a}/${id}.webp`));
});
test('weekly ranking caps repeat opponents and excludes insufficient votes and last-week wins',async()=>{
 const insert=async(opponent,votes,when)=>sql("insert into ego_challenges(creator,opponent,visibility,status,winner,creator_votes,opponent_votes,completed_at) values($1,$2,'public','completed',$1,$3,0,"+when+")",[a,opponent,votes]);
 await insert(b,15,'now()');await insert(v1,2,'now()');await insert(v2,20,"(date_trunc('week',now() at time zone 'America/New_York') at time zone 'America/New_York')-interval '1 second'");
 const ranking=await as(a,'rankings');assert.equal(ranking.weekly.find(p=>p.id===a).wins,1);
 // One earlier win against b, one against v2 in the previous week; the two-vote battle is ineligible.
 assert.equal((await as(a,'summary')).wins,2);
});
test('open invitation cannot be cancelled by a stranger or claimed twice',async()=>{
 const id=(await as(a,'create',{visibility:'public'})).id;
 await assert.rejects(as(v1,'cancel',{id}));
 const invitation=await as(v1,'battle',{id});assert.deepEqual(invitation.entries,[]);
 await as(v1,'accept',{id});await assert.rejects(as(v2,'accept',{id}));
});
test('monthly upvotes exclude legacy votes and removing a current upvote removes its monthly credit',async()=>{
 const image=(await sql("select image_id from ego_gallery_results where user_id=$1 limit 1",[a]))[0].image_id;
 await db.exec('set role authenticated');await sql("select set_config('request.jwt.claim.sub',$1,false)",[v1]);
 try{await sql('select set_photo_vote($1,null::smallint)',[image]);}finally{await db.exec('reset role');}
 const ranking=await as(a,'rankings');assert.ok(!ranking.monthly.some(x=>x.id===image));
 // A baseline vote has no monthly receipt, so it must not be backdated into a ranking.
 await sql('insert into photo_votes values($1,$2,1)',[image,v2]);await sql('delete from ego_vote_months where photo_id=$1 and voter_id=$2',[image,v2]);
 assert.ok(!(await as(a,'rankings')).monthly.some(x=>x.id===image));
});

test('approved gallery roast survives editable descriptions and battle receipts cannot be replayed',async()=>{
 const image=(await sql('select image_id from ego_gallery_results where user_id=$1 limit 1',[a]))[0].image_id;
 await sql("update images set description='An owner-written note' where id=$1",[image]);
 const meta=await as(v1,'gallery_metadata',{ids:[image]});assert.equal(meta[0].roast,'A verified roast');
 const id=(await as(a,'create',{visibility:'public',opponent:b})).id;await as(b,'accept',{id});
 await assert.rejects(sql("select ego_server_action($1,'entry',$2::jsonb)",[a,JSON.stringify({id,receipt:`${a}-${battle}`,roast:'A replayed caption',path:`${a}/${id}.webp`})]));
 assert.equal((await as(a,'battle',{id})).entries.length,0);
});
test('publication leases serialize publication with unpublishing and are service-only',async()=>{
 const t1='30000000-0000-4000-8000-000000000001',t2='30000000-0000-4000-8000-000000000002';
 const lease=async(token,release=false)=>(await sql('select ego_publication_lease($1,$2,$3,$4) x',[a,battle,token,release]))[0].x;
 assert.equal(await lease(t1),true);assert.equal(await lease(t2),false);await lease(t1,true);assert.equal(await lease(t2),true);await lease(t2,true);
 await db.exec('set role authenticated');try{await assert.rejects(sql('select ego_publication_lease($1,$2,$3,false)',[a,battle,t1]));await assert.rejects(sql("select ego_server_action($1,'publish',$2::jsonb)",[a,JSON.stringify({id:battle})]));}finally{await db.exec('reset role');}
});
test('weekly period excludes next Monday even for a trusted future-dated fixture',async()=>{
 await sql("insert into ego_challenges(creator,opponent,visibility,status,winner,creator_votes,opponent_votes,completed_at) values($1,$2,'public','completed',$1,30,0,(date_trunc('week',now() at time zone 'America/New_York')+interval '1 week') at time zone 'America/New_York')",[outsider,v3]);
 assert.ok(!(await as(a,'rankings')).weekly.some(p=>p.id===outsider));
});
