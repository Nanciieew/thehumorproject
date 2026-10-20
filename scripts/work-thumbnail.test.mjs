import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import sharp from 'sharp';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';
process.env.SUPABASE_SECRET_KEY='fixture-key';
const {supabase}=await import('../lib/supabase.ts');
const {workThumbnail}=await import('../lib/work-thumbnail.ts');
const originalFrom=supabase.from,originalStorage=supabase.storage.from;
after(()=>{supabase.from=originalFrom;supabase.storage.from=originalStorage;});
const owner='10000000-0000-4000-8000-000000000001',id='20000000-0000-4000-8000-000000000001';

test('private thumbnails reject guests, invalid sizes and foreign works before any storage download',async()=>{
  supabase.from=()=>{throw new Error('Must not query');};
  assert.equal((await workThumbnail(null,id,640)).status,401);
  assert.equal((await workThumbnail(owner,'bad',640)).status,404);
  assert.equal((await workThumbnail(owner,id,9000)).status,400);
  supabase.storage.from=()=>{throw new Error('Must not download foreign media');};
  supabase.from=()=>{const filters=[];return {select(){return this;},eq(k,v){filters.push([k,v]);return this;},async maybeSingle(){assert.deepEqual(filters,[['contributor_id',owner],['id',id]]);return {error:null,data:null};}};};
  const denied=await workThumbnail(owner,id,640);assert.equal(denied.status,404);assert.match(denied.headers.get('Cache-Control'),/no-store/);
});

test('owner thumbnails resize to responsive bounds and use browser-only, cookie-varying caching',async()=>{
  const original=await sharp({create:{width:1600,height:800,channels:3,background:'#e8f044'}}).png().toBuffer();
  supabase.from=()=>({select(){return this;},eq(){return this;},async maybeSingle(){return {error:null,data:{private_storage_path:`${owner}/original.webp`}};}});
  supabase.storage.from=bucket=>{assert.equal(bucket,'generated-images');return {async download(path){assert.equal(path,`${owner}/original.webp`);return {error:null,data:new Blob([original])};}};};
  const response=await workThumbnail(owner,id,320);
  assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/webp');
  assert.equal(response.headers.get('Vary'),'Cookie');assert.equal(response.headers.get('Cache-Control'),'private, max-age=300');
  const meta=await sharp(Buffer.from(await response.arrayBuffer())).metadata();assert.equal(meta.width,320);assert.equal(meta.height,160);
});
