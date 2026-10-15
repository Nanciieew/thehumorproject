import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';
process.env.SUPABASE_SECRET_KEY='fixture-key';
const {supabase}=await import('../lib/supabase.ts');
const {signReceipt}=await import('../lib/roast/receipt.ts');
const {publishRoast}=await import('../lib/roast/publication.ts');
const originalFrom=supabase.from, originalStorage=supabase.storage.from;
const owner=randomUUID(), rows=new Map(), objects=new Map();
let failInsert=false, lostResponse=false;
const snapshot=(await sharp({create:{width:80,height:60,channels:3,background:'#808080'}}).jpeg().toBuffer()).toString('base64');
const roast='Those sunglasses are doing all the personality work.';
const input=()=>({approved:true,snapshot,receipt:signReceipt(owner,roast,snapshot),roast:'Client text must be ignored.'});
supabase.from=table=>{
 assert.equal(table,'images');let values=null;const filters=[];
 const query={select(){return this;},eq(key,value){filters.push([key,value]);return this;},insert(row){values=row;return this;},async maybeSingle(){const row=[...rows.values()].find(r=>filters.every(([k,v])=>r[k]===v));return {data:row?{...row}:null,error:null};},async single(){
  if(failInsert)return {data:null,error:{message:'Injected failure'}};
  if(rows.has(values.id))return {data:null,error:{code:'23505'}};
  rows.set(values.id,{...values});
  return lostResponse?{data:null,error:{message:'Response lost after commit'}}:{data:{id:values.id},error:null};
 }};return query;
};
supabase.storage.from=bucket=>{
 assert.equal(bucket,'gallery-photos');return{
  async upload(path,bytes){await new Promise(resolve=>setImmediate(resolve));objects.set(path,Buffer.from(bytes));return{error:null};},
  async remove(paths){paths.forEach(path=>objects.delete(path));return{error:null};}
 };
};
beforeEach(()=>{rows.clear();objects.clear();failInsert=false;lostResponse=false;});
after(()=>{supabase.from=originalFrom;supabase.storage.from=originalStorage;});
test('publication requires public approval, a real receipt and the matching owner and snapshot',async()=>{
 const body=input();
 for(const invalid of [{...body,approved:false},{...body,receipt:'mock'},{...body,snapshot:'AAAA'}])await assert.rejects(publishRoast(owner,invalid));
 await assert.rejects(publishRoast(randomUUID(),body));
 assert.equal(rows.size,0);assert.equal(objects.size,0);
});
test('solo publication saves the verified roast and normalized image using ordinary gallery voting',async()=>{
 const id=await publishRoast(owner,input());const row=rows.get(id);
 assert.equal(row.description,roast);assert.equal(row.title,'Ego checked.');assert.equal(row.source,'upload');assert.equal(row.contributor_id,owner);
 assert.ok(row.published_at);assert.ok(row.public_storage_path.startsWith(`${owner}/roast-`));
 const meta=await sharp(objects.get(row.public_storage_path)).metadata();assert.equal(meta.format,'webp');assert.equal(meta.width,80);
 assert.equal(row.battle_votes,undefined,'a solo card invents no battle tally');
});
test('retries and concurrent publication create one card without resetting its votes or removing its image',async()=>{
 const body=input();const ids=await Promise.all([publishRoast(owner,body),publishRoast(owner,body),publishRoast(owner,body)]);
 assert.equal(new Set(ids).size,1);assert.equal(rows.size,1);assert.equal(objects.size,1);
 const row=rows.get(ids[0]);row.upvotes=7;
 assert.equal(await publishRoast(owner,body),ids[0]);assert.equal(row.upvotes,7);assert.equal(objects.size,1);
});
test('failed saves clean only their attempt and remain retryable',async()=>{
 const body=input();failInsert=true;await assert.rejects(publishRoast(owner,body),/Couldn’t publish/);
 assert.equal(objects.size,0);assert.equal(rows.size,0);
 failInsert=false;await publishRoast(owner,body);assert.equal(rows.size,1);assert.equal(objects.size,1);
});
test('a database commit with a lost response keeps the successfully published image',async()=>{
 lostResponse=true;const id=await publishRoast(owner,input());
 assert.ok(objects.has(rows.get(id).public_storage_path));assert.equal(objects.size,1);
});
test('signed unsupported and oversized snapshots still fail media validation',async()=>{
 const png=(await sharp({create:{width:20,height:20,channels:3,background:'#fff'}}).png().toBuffer()).toString('base64');
 const large=(await sharp({create:{width:641,height:20,channels:3,background:'#fff'}}).jpeg().toBuffer()).toString('base64');
 for(const frame of [png,large])await assert.rejects(publishRoast(owner,{approved:true,snapshot:frame,receipt:signReceipt(owner,roast,frame)}),/Invalid roast snapshot/);
 assert.equal(objects.size,0);
});
