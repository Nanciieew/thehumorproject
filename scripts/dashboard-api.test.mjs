import assert from 'node:assert/strict';
import { after, test } from 'node:test';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';
process.env.SUPABASE_SECRET_KEY='fixture-key';
const {supabase}=await import('../lib/supabase.ts');
const {readDashboardTotals}=await import('../lib/dashboard.ts');
const originalRpc=supabase.rpc, originalFrom=supabase.from;
after(()=>{supabase.rpc=originalRpc;supabase.from=originalFrom;});
test('installed aggregate returns exact totals scoped to the authenticated contributor',async()=>{
 const expected={published_count:'2',upvotes:'5',revenue_cents:'90071992547409930'};
 supabase.rpc=async(name,args)=>{assert.equal(name,'personal_dashboard_summary');assert.deepEqual(args,{p_contributor_id:'owner'});return {data:expected,error:null};};
 assert.deepEqual(await readDashboardTotals('owner'),expected);
});
test('existing-schema fallback reads every page, ignores downvotes and subtracts refunds exactly',async()=>{
 supabase.rpc=async()=>({error:{code:'PGRST202'},data:null});
 const ids=Array.from({length:503},(_,index)=>String(index).padStart(4,'0'));
 const queries=[];
 supabase.from=table=>{
  const q={table,after:null,size:250,filters:[]};queries.push(q);
  const builder={select(){return this;},eq(column,value){q.filters.push([column,value]);return this;},not(column,op,value){q.filters.push([column,op,value]);return this;},lte(column){q.filters.push([column]);return this;},order(){return this;},limit(size){q.size=size;return this;},gt(column,value){assert.equal(column,'id');q.after=value;return this;},in(column,values){assert.equal(column,'photo_id');q.ids=values;return this;},then(resolve){
   let data;
   if(table==='gallery_vote_totals') data=q.ids.map(()=>({upvotes:2,downvotes:999}));
   else {
    assert.ok(q.filters.some(([column,value])=>column===(table==='images'?'contributor_id':'seller_id')&&value==='owner'));
    const page=ids.filter(id=>!q.after||id>q.after).slice(0,q.size);
    data=page.map(id=>table==='images'?{id}:{id,amount_cents:9007199254740991,refunded_cents:1});
   }
   return Promise.resolve(resolve({data,error:null}));
  }};return builder;
 };
 const result=await readDashboardTotals('owner');
 assert.deepEqual(result,{published_count:'503',upvotes:'1006',revenue_cents:(BigInt('9007199254740990')*BigInt(503)).toString()});
 assert.equal(queries.filter(q=>q.table==='images').length,3);
 assert.equal(queries.filter(q=>q.table==='image_sales').length,3);
 assert.ok(queries.filter(q=>q.table==='images').every(q=>q.filters.some(([column,op,value])=>column==='published_at'&&op==='is'&&value===null)));
});
test('database failures never become misleading zero totals',async()=>{
 supabase.rpc=async()=>({error:{code:'42501'},data:null});
 await assert.rejects(readDashboardTotals('owner'),/Couldn’t load/);
});
