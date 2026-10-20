import assert from 'node:assert/strict';
import { after, test } from 'node:test';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';
process.env.SUPABASE_SECRET_KEY='fixture-key';
const { supabase } = await import('../lib/supabase.ts');
const { readOwnedWorks, deleteWork } = await import('../lib/works.ts');
const originalFrom=supabase.from, originalStorage=supabase.storage.from, originalRpc=supabase.rpc;
after(()=>{supabase.from=originalFrom;supabase.storage.from=originalStorage;supabase.rpc=originalRpc;});
const owner='10000000-0000-4000-8000-000000000001';
const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rows=Array.from({length:35},(_,index)=>({id:id(index+1),contributor_id:owner,source:'upload',created_at:new Date(Date.UTC(2026,9,index+1)).toISOString(),published_at:new Date(Date.UTC(2026,9,index+1)).toISOString(),title:'Meme',description:'',public_storage_path:`${owner}/${index}.webp`,private_storage_path:null}));
function fixture() {
 supabase.rpc=async()=>({data:null,error:{code:'PGRST202'}});
 const deleted=[],media=[];
 supabase.from=table=>{
  const filters=[];let removing=false;
  const query={select(){return this;},eq(k,v){filters.push([k,v]);return this;},order(){return this;},limit(){return this;},gt(){return this;},in(k,v){filters.push([k,v]);return this;},delete(){removing=true;return this;},async maybeSingle(){assert.ok(filters.some(([k,v])=>k==='contributor_id'&&v===owner));return {data:rows.find(row=>filters.every(([k,v])=>row[k]===v))??null,error:null};},then(resolve){
   if(table==='images') {
    assert.ok(filters.some(([k,v])=>k==='contributor_id'&&v===owner),'all image reads and deletions must be owner scoped');
    if(removing){deleted.push(filters);return Promise.resolve(resolve({data:[{id:filters.find(([k])=>k==='id')[1]}],error:null}));}
    return Promise.resolve(resolve({data:rows,error:null}));
   }
   assert.equal(table,'gallery_vote_totals');
   const ids=filters.find(([k])=>k==='photo_id')[1];
   return Promise.resolve(resolve({data:ids.map(photo_id=>({photo_id,upvotes:photo_id===id(1)?'9007199254740993':'2',downvotes:'1'})),error:null}));
  }};return query;
 };
 supabase.storage.from=bucket=>({getPublicUrl:path=>({data:{publicUrl:`https://fixture/${path}`}}),async remove(paths){media.push({bucket,paths});return{error:null};}});
 return {deleted,media};
}
test('default sort ranks the entire collection by canonical votes and preserves bigint counts across pages',async()=>{
 fixture();const first=await readOwnedWorks(owner);
 assert.equal(first.items.length,30);assert.equal(first.items[0].work_id,id(1));
 assert.equal(first.items[1].work_id,id(35),'newest first breaks score ties');
 assert.equal(first.items[0].upvotes,'9007199254740993');
 assert.deepEqual(first.received,{upvotes:(BigInt('9007199254740993')+BigInt(68)).toString(),downvotes:'35'});
 const next=await readOwnedWorks(owner,first.next_cursor);
 assert.equal(next.items.length,5);assert.equal(new Set([...first.items,...next.items].map(row=>row.work_id)).size,35);
 assert.equal(next.next_cursor,null);
 const newest=await readOwnedWorks(owner,null,'newest');assert.equal(newest.items[0].work_id,id(35));
 await assert.rejects(readOwnedWorks(owner,first.next_cursor,'newest'),/Invalid works cursor/);
});
test('database pagination returns one owner-scoped page and does not scan the collection or sign originals',async()=>{
 const calls=[];
 supabase.rpc=async(name,args)=>{calls.push({name,args});return {error:null,data:{items:[{...rows[0],upvotes:'9007199254740993',downvotes:'1'},{...rows[1],source:'generated',published_at:null,public_storage_path:null,private_storage_path:`${owner}/private.webp`,upvotes:'0',downvotes:'0'}],next_cursor:{sort:'top',id:id(2),time:rows[1].created_at,upvotes:'0'},received:{upvotes:'9007199254740993',downvotes:'1'}}};};
 supabase.from=()=>{throw new Error('Must not scan all works');};
 supabase.storage.from=()=>({getPublicUrl:path=>({data:{publicUrl:`https://fixture/${path}`}}),createSignedUrl(){throw new Error('Listings must not sign originals');}});
 const page=await readOwnedWorks(owner);
 assert.equal(calls.length,1);assert.equal(calls[0].name,'owned_works_page');assert.equal(calls[0].args.p_contributor_id,owner);
 assert.equal(page.items[0].upvotes,'9007199254740993');assert.match(page.items[0].photo_url,/https:\/\/fixture/);
 assert.equal(page.items[1].photo_url,`/api/my-works/${id(2)}/thumbnail`);
 await readOwnedWorks(owner,page.next_cursor);
 assert.equal(calls[1].args.p_cursor.sort,'top');assert.equal(calls[1].args.p_cursor.id,id(2));
 supabase.rpc=async()=>({data:null,error:{code:'42501'}});
 await assert.rejects(readOwnedWorks(owner),/Couldn’t load your works/);
});
test('deletion requires confirmation, cannot delete another owner’s meme, and removes both database row and media',async()=>{
 const state=fixture();await assert.rejects(deleteWork(owner,id(1),false),/Confirm deletion/);assert.equal(state.deleted.length,0);
 await deleteWork(owner,id(99),true);assert.equal(state.deleted.length,0);assert.equal(state.media.length,0);
 await deleteWork(owner,id(1),true);assert.equal(state.deleted.length,1);
 assert.deepEqual(state.media,[{bucket:'gallery-photos',paths:[`${owner}/0.webp`]}]);
});
test('a rejected database deletion never removes its image files',async()=>{
 const state=fixture();const queryFrom=supabase.from;
 supabase.from=table=>{const q=queryFrom(table);q.delete=function(){this.then=resolve=>Promise.resolve(resolve({data:null,error:{code:'23503'}}));return this;};return q;};
 await assert.rejects(deleteWork(owner,id(1),true),/Couldn’t delete/);assert.equal(state.media.length,0);
});
