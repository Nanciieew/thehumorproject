import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { registerHooks } from 'node:module';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';
process.env.SUPABASE_SECRET_KEY='fixture-key';
registerHooks({resolve(specifier,context,next){
  if(specifier==='@/lib/auth/server') return {url:'fixture:gallery-auth',shortCircuit:true};
  return next(specifier,context);
},load(url, context, next){
  if(url==='fixture:gallery-auth') return {format:'module',shortCircuit:true,source:'export async function createAuthClient() { return globalThis.galleryAuthFixture; }'};
  return next(url,context);
}});
const {supabase}=await import('../lib/supabase.ts');
const {readGallery}=await import('../lib/gallery.ts');
const originalFrom=supabase.from,originalStorage=supabase.storage.from;
after(()=>{supabase.from=originalFrom;supabase.storage.from=originalStorage;delete globalThis.galleryAuthFixture;});

test('gallery enrichments run concurrently and sign duplicate profile paths in one batch',async()=>{
  const calls=[];let releaseVotes;
  const votes=new Promise(resolve=>{releaseVotes=resolve;});
  globalThis.galleryAuthFixture={
    auth:{async getUser(){return {data:{user:{id:'viewer'}}};}},
    async rpc(name){calls.push(name);return name==='gallery_feed'
      ? {error:null,data:{items:[{id:'one',storage_path:'public/one.webp',upvotes:2},{id:'two',storage_path:'public/two.webp',upvotes:0}],next_cursor:null}}
      : {error:null,data:[]};},
    from(table){assert.equal(table,'photo_votes');return {select(){return this;},in(){return this;},eq(){calls.push('votes');return votes;}};},
  };
  supabase.from=table=>({select(){return this;},in(){calls.push(table);return Promise.resolve({error:null,data:table==='images'
    ? [{id:'one',contributor_id:'author-a'},{id:'two',contributor_id:'author-b'}]
    : [{id:'author-a',avatar_path:'shared/avatar.webp'},{id:'author-b',avatar_path:'shared/avatar.webp'}]});}});
  supabase.storage.from=bucket=>({
    async createSignedUrls(paths){assert.equal(bucket,'profile-photos');calls.push('sign');assert.deepEqual(paths,['shared/avatar.webp']);return {error:null,data:[{path:paths[0],signedUrl:'https://fixture/signed-avatar',error:null}]};},
    getPublicUrl(path){assert.equal(bucket,'gallery-photos');return {data:{publicUrl:`https://fixture/${path}`}};},
  });
  const pending=readGallery('top');
  await new Promise(setImmediate);
  assert.ok(calls.includes('votes'));assert.ok(calls.includes('ego_action'));
  assert.ok(calls.includes('profiles'));assert.ok(calls.includes('sign'),'signing must not wait for personal votes');
  releaseVotes({error:null,data:[{photo_id:'one',value:1}]});
  const page=await pending;
  assert.equal(page.items[0].vote,1);assert.equal(page.items[1].vote,null);
  assert.ok(page.items.every(item=>item.contributor_photo_url==='https://fixture/signed-avatar'));
  assert.equal(calls.filter(call=>call==='sign').length,1);
});
