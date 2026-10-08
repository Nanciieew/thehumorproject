import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const sql = async (query, args = []) => (await db.query(query,args)).rows;
await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema storage;
 grant usage on schema public,auth,storage to anon,authenticated,service_role;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb,last_sign_in_at timestamptz);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text); alter table storage.objects enable row level security;
`);
for (const name of [
 '20260930000000_create_profiles_on_first_sign_in','20260930000001_add_profile_names','20260930000002_remove_profile_display_name',
 '20261001000000_add_profile_photos','20261006000000_add_profile_state_onboarding','20261007000000_create_profiles_after_onboarding',
 '20261007000001_avatar_gallery','20261007000002_my_works','20261007000003_consolidate_images',
 '20261007000004_remove_legacy_image_tables','20261007000005_remove_avatar','20261007000006_gallery_publication_order',
 '20261007000007_remove_my_works_view',
]) await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
const a='10000000-0000-4000-8000-000000000001';
const b='10000000-0000-4000-8000-000000000002';
const c='10000000-0000-4000-8000-000000000003';
const pending='10000000-0000-4000-8000-000000000004';
const older='20000000-0000-4000-8000-000000000001';
const newA='20000000-0000-4000-8000-000000000002';
const newB='20000000-0000-4000-8000-000000000003';
const privateA='20000000-0000-4000-8000-000000000004';
const [{start,end}]=await sql("select date_trunc('month',now() at time zone 'America/New_York') at time zone 'America/New_York' as start,(date_trunc('month',now() at time zone 'America/New_York')+interval '1 month') at time zone 'America/New_York' as end");
await db.exec(`
 insert into auth.users(id) values('${a}'),('${b}'),('${c}'),('${pending}');
 insert into public.profiles(id,first_name,last_name,state_code,onboarding_completed_at) values
 ('${a}','Alice','Example','NY',now()),('${b}','Bob','Example','TX',now()),('${c}','Carol','Example','CA',now()),('${pending}','Pending','Example','NY',null);
`);
for (const [id,owner,age,privateImage] of [[older,a,-2,false],[newA,a,0,false],[newB,b,0,false],[privateA,a,0,true]]) {
 const published=new Date(start.getTime()+age*86400000);
 const created=new Date(published.getTime()-(id===privateA?3000:id===newA?2000:1000));
 await sql(`insert into public.images(id,contributor_id,source,private_storage_path,public_storage_path,created_at,published_at)
 values($1,$2,'generated',$3,$4,$5,$6)`,[id,owner,`${owner}/${id}.webp`,privateImage?null:`${owner}/public-${id}.webp`,created,privateImage?null:published]);
}
await db.exec(await readFile(new URL('../supabase/migrations/20261008000000_sales_leaderboard.sql',import.meta.url),'utf8'));
after(()=>db.close());
async function as(role,action){await db.exec(`set role ${role}`);try{return await action();}finally{await db.exec('reset role');}}
const summary=async(period='monthly',cursor=null,limit=30)=>(await as('service_role',()=>sql('select public.leaderboard_summary($1,$2::jsonb,$3) as result',[period,cursor&&JSON.stringify(cursor),limit])))[0].result;
const sale=async(id,amount,reference,date=null)=>(await as('service_role',()=>sql('select public.record_image_sale($1,$2,$3,$4) as id',[id,amount,reference,date])))[0].id;
const refund=async(id,amount)=>as('service_role',()=>sql('select public.record_image_refund($1,$2)',[id,amount]));
let saleOne;

test('migration preserves images, backfills publication state and starts with no sales',async()=>{
 assert.equal((await sql('select count(*)::int as n from public.images'))[0].n,4);
 assert.equal((await sql('select publication_state_code from public.images where id=$1',[newA]))[0].publication_state_code,'NY');
 assert.equal((await sql('select publication_state_code from public.images where id=$1',[privateA]))[0].publication_state_code,null);
 const result=await summary(); assert.equal(result.individuals.length,2);
 assert.ok(result.individuals.every(x=>x.revenue_cents==='0'));
 assert.deepEqual(result.monthly_rewards,[{rank:1,credits:2000},{rank:2,credits:1000},{rank:3,credits:500}]);
 assert.equal(Date.parse(result.month_start),start.getTime());
});

test('multiple sales and retries preserve each sale amount and state; price changes do not rewrite history',async()=>{
 saleOne=await sale(older,2000,'first-sale',start);
 assert.equal(await sale(older,2000,'first-sale',start),saleOne);
 await assert.rejects(sale(older,2001,'first-sale'),/different sale details/);
 await sql("update public.images set price_cents=9999 where id=$1",[older]);
 await sql("update public.profiles set state_code='CA' where id=$1",[a]);
 await sale(older,1000,'second-sale',start);
 await sale(newB,1500,'bob-sale',start);
 await sale(older,5000,'previous-month',new Date(start.getTime()-86400000));
 assert.deepEqual((await sql('select amount_cents::int,seller_state_code from public.image_sales where reference=$1',['first-sale']))[0],{amount_cents:2000,seller_state_code:'NY'});
 assert.equal((await sql('select seller_state_code from public.image_sales where reference=$1',['second-sale']))[0].seller_state_code,'CA');
 assert.equal((await sql('select publication_state_code from public.images where id=$1',[newA]))[0].publication_state_code,'NY');
 await refund(saleOne,200); await refund(saleOne,200);
 await assert.rejects(refund(saleOne,2001),/check constraint/);
 await assert.rejects(refund(saleOne,100),/cannot decrease/);
 await assert.rejects(sql('update public.image_sales set amount_cents=10 where id=$1',[saleOne]),/immutable/);
 await assert.rejects(sql('delete from public.images where id=$1',[older]),/foreign key/);
 await assert.rejects(sql('delete from public.profiles where id=$1',[a]),/foreign key/);
});

test('monthly creator and region revenue includes old avatars sold this month; contribution counts use publication month',async()=>{
 const monthly=await summary(); const all=await summary('all_time');
 assert.deepEqual(monthly.individuals.map(x=>[x.contributor_id,x.revenue_cents]),[[a,'2800'],[b,'1500']]);
 assert.equal(monthly.individuals[0].avatars_made,1); assert.equal(all.individuals[0].avatars_made,2);
 assert.equal(all.individuals[0].revenue_cents,'7800');
 assert.deepEqual(monthly.podium,monthly.individuals);
 assert.deepEqual(monthly.monthly_top_regions.map(x=>[x.state_code,x.revenue_cents,x.avatars_contributed]),[['NY','1800',1],['TX','1500',1],['CA','1000',0]]);
 assert.deepEqual(all.monthly_top_regions,monthly.monthly_top_regions);
 assert.equal((await sql('select publication_state_code from public.images where id=$1',[newA]))[0].publication_state_code,'NY');
});

test('top monthly avatars use current upvotes, exclude older/private avatars and break ties by creation',async()=>{
 for(const image of [newA,newB]) for(const voter of [a,b]) await sql('insert into public.photo_votes values($1,$2,1)',[image,voter]);
 await sql('insert into public.photo_votes values($1,$2,-1)',[newA,c]);
 for(const voter of [a,b,c]) await sql('insert into public.photo_votes values($1,$2,1)',[older,voter]);
 const monthly=await summary();
 assert.deepEqual(monthly.monthly_top_avatars.map(x=>[x.id,x.upvotes]),[[newB,2],[newA,2]]);
 assert.ok(monthly.monthly_top_avatars.every(x=>x.title==='Untitled avatar'));
 assert.equal(monthly.individuals[0].total_votes,2); assert.equal((await summary('all_time')).individuals[0].total_votes,5);
 assert.deepEqual((await summary('all_time')).monthly_top_avatars,monthly.monthly_top_avatars);
});

test('sales and all backend RPCs reject browser roles; published seller facts are validated',async()=>{
 for(const role of ['anon','authenticated']) {
  await assert.rejects(as(role,()=>sql('select * from public.image_sales')),/permission denied/);
  await assert.rejects(as(role,()=>sql("select public.record_image_sale($1,100,'spoof',null)",[newA])),/permission denied/);
  await assert.rejects(as(role,()=>sql('select public.record_image_refund($1,0)',[saleOne])),/permission denied/);
  await assert.rejects(as(role,()=>sql("select public.leaderboard_summary('monthly',null,30)")),/permission denied/);
 }
 await assert.rejects(sale(privateA,100,'private'),/Only published/);
 await assert.rejects(sale(newA,100,'future',end),/future/);
 await assert.rejects(sale(newA,100,'before-publication',new Date(start.getTime()-1)),/after publication/);
 await assert.rejects(sale(newA,0,'zero'),/check constraint/);
 await assert.rejects(sale(newA,100,''),/transaction reference/);
 await assert.rejects(as('service_role',()=>sql('update public.image_sales set seller_id=$1 where id=$2',[b,saleOne])),/permission denied/);
 const id='20000000-0000-4000-8000-000000000005';
 await sql("insert into public.images(id,contributor_id,source,private_storage_path,public_storage_path,published_at) values($1,$2,'generated',$3,$4,$5)",[id,pending,`${pending}/p.webp`,`${pending}/q.webp`,start]);
 await assert.rejects(sale(id,100,'pending'),/completed profile/);
 assert.ok(!(await summary()).individuals.some(x=>x.contributor_id===pending));
});

test('publication snapshots derive the current state, and private caption edits remain allowed',async()=>{
 await sql('update public.images set published_at=$1,public_storage_path=$2 where id=$3',[start,`${a}/published-private.webp`,privateA]);
 assert.equal((await sql('select publication_state_code from public.images where id=$1',[privateA]))[0].publication_state_code,'CA');
 await assert.rejects(sql("update public.images set publication_state_code='TX' where id=$1",[privateA]),/historical/);
 await sql("select set_config('request.jwt.claim.sub',$1,false)",[a]);
 await as('authenticated',()=>sql("update public.images set title='New title' where id=$1",[newA]));
});

test('ranking ties and cursor pagination match full results; sidebar remains monthly',async()=>{
 await refund(saleOne,1500); // Alice and Bob now both have 1500 cents; Bob created the newer avatar.
 let full=await summary(); assert.equal(full.individuals[0].contributor_id,b);
 // With equal creation timestamps, contributor UUID is the final stable tie-breaker.
 await sql('update public.images set created_at=(select max(created_at) from public.images where contributor_id=$1) where id=$2',[a,newB]);
 assert.equal((await summary()).individuals[0].contributor_id,a);
 for(const period of ['monthly','all_time']) {
  full=await summary(period);const seen=[];let cursor=null;
  do {const page=await summary(period,cursor,1);seen.push(...page.individuals);cursor=page.next_cursor;assert.deepEqual(page.podium,full.podium);}while(cursor);
  assert.deepEqual(seen,full.individuals);
 }
 await assert.rejects(summary('bad'),/Invalid leaderboard period/);
 await assert.rejects(summary('monthly',{period:'all_time',rank:1,as_of:new Date().toISOString()}),/Invalid leaderboard cursor/);
});

test('New York calendar months use DST-aware half-open boundaries',async()=>{
 const clock='2026-03-15T12:00:00Z';
 const result=await summary('monthly',{period:'monthly',rank:0,as_of:clock});
 assert.equal(Date.parse(result.month_start),Date.parse('2026-03-01T05:00:00Z'));
 assert.equal(Date.parse(result.month_end),Date.parse('2026-04-01T04:00:00Z'));
});


test('month start includes boundary sales and next-month start excludes them from the previous month',async()=>{
 const archived='20000000-0000-4000-8000-000000000099';
 await sql("insert into public.images(id,contributor_id,source,private_storage_path,public_storage_path,published_at,created_at) values($1,$2,'generated',$3,$4,'2026-02-01T00:00:00Z','2026-01-31T00:00:00Z')",[archived,b,`${b}/archived-private.webp`,`${b}/archived-public.webp`]);
 for(const [reference,date,amount] of [['march-start','2026-03-01T05:00:00Z',1000],['april-start','2026-04-01T04:00:00Z',2000]]) {
  await sql('insert into public.image_sales(image_id,amount_cents,reference,sold_at,recorded_at) values($1,$2,$3,$4,$4)',[archived,amount,reference,date]);
 }
 const march=await summary('monthly',{period:'monthly',rank:0,as_of:'2026-04-01T03:59:59.999999Z'});
 assert.equal(march.individuals.find(x=>x.contributor_id===b).revenue_cents,'1000');
 assert.equal(march.individuals.find(x=>x.contributor_id===b).avatars_made,0);
 const april=await summary('monthly',{period:'monthly',rank:0,as_of:'2026-04-01T04:00:00Z'});
 assert.equal(april.individuals.find(x=>x.contributor_id===b).revenue_cents,'2000');
});
