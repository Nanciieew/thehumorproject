import assert from 'node:assert/strict';
import { after, test } from 'node:test';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';
process.env.SUPABASE_SECRET_KEY='fixture-key';
const {supabase}=await import('../lib/supabase.ts');
const {readCheckboardTotals,readReceivedVotes}=await import('../lib/checkboard.ts');
const originalFrom=supabase.from;
after(()=>{supabase.from=originalFrom;});

test('received totals include all published pages, match all gallery and quest votes, and retain exact large counts',async()=>{
 const ids=Array.from({length:503},(_,i)=>String(i).padStart(4,'0'));
 let pages=0;
 supabase.from=table=>{
  const state={after:null,size:250,ids:[],filters:[]};
  const q={select(){return this;},eq(col,val){state.filters.push([col,val]);return this;},not(col,op,val){state.filters.push([col,op,val]);return this;},lte(){return this;},order(){return this;},limit(n){state.size=n;return this;},gt(col,val){state.after=val;return this;},in(col,values){state.ids=values;return this;},then(resolve){
   let data;
   if(table==='images') {
    pages++;assert.ok(state.filters.some(([col,val])=>col==='contributor_id'&&val==='owner'));
    assert.ok(state.filters.some(([col,op,val])=>col==='published_at'&&op==='is'&&val===null));
    data=ids.filter(id=>!state.after||id>state.after).slice(0,state.size).map(id=>({id}));
   } else if(table==='gallery_vote_totals') data=state.ids.map(photo_id=>({photo_id,upvotes:'9007199254740993',downvotes:'5'}));
   else { assert.equal(table,'photo_votes');assert.deepEqual(state.filters,[['voter_id','owner']]);data=state.ids.map((photo_id,i)=>({photo_id,value:i%2?1:-1})); }
   return Promise.resolve(resolve({data,error:null}));
  }};return q;
 };
 const result=await readCheckboardTotals('owner');
 assert.deepEqual(result,{upvotes:(BigInt('9007199254740993')*BigInt(503)).toString(),downvotes:'2515'});
 assert.equal(pages,3);
});
test('empty accounts return zero without querying vote tables',async()=>{
 supabase.from=table=>{assert.equal(table,'images');const q={select(){return this;},eq(){return this;},not(){return this;},lte(){return this;},order(){return this;},limit(){return this;},then(resolve){return Promise.resolve(resolve({data:[],error:null}));}};return q;};
 assert.deepEqual(await readCheckboardTotals('owner'),{upvotes:'0',downvotes:'0'});
});
test('vote failures remain unavailable rather than appearing as zero',async()=>{
 supabase.from=()=>{const q={select(){return this;},eq(){return this;},in(){return this;},then(resolve){return Promise.resolve(resolve({data:null,error:{code:'42501'}}));}};return q;};
 await assert.rejects(readReceivedVotes(['one'],'owner'),/Couldn’t load received votes/);
});
