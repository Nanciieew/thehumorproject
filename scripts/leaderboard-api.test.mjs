import assert from 'node:assert/strict';
import { after, test } from 'node:test';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';
process.env.SUPABASE_SECRET_KEY='fixture-key';
const {supabase}=await import('../lib/supabase.ts');
const {readLeaderboard}=await import('../lib/leaderboard.ts');
const {decodeLeaderboardCursor,InvalidLeaderboardCursor}=await import('../lib/leaderboard-types.ts');
const originalRpc=supabase.rpc;const originalStorage=supabase.storage.from;
after(()=>{supabase.rpc=originalRpc;supabase.storage.from=originalStorage;});
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');

test('validates cursors before querying and preserves period and rank',()=>{
 const value={period:'monthly',rank:30,as_of:'2026-01-01T05:00:00Z'};
 assert.deepEqual(decodeLeaderboardCursor(encode(value),'monthly'),value);
 for(const cursor of ['garbage',encode(null),encode({...value,period:'all_time'}),encode({...value,rank:-1}),encode({...value,rank:1.5}),encode({...value,as_of:'2099-01-01T00:00:00Z'}),'!'.repeat(3000)]) {
  assert.throws(()=>decodeLeaderboardCursor(cursor,'monthly'),InvalidLeaderboardCursor);
 }
});

test('summary signs profile photos once, expands state names and never exposes raw paths or sales',async()=>{
 const individual={rank:1,contributor_id:'owner',name:'Full Name',avatar_path:'owner/avatar.webp',avatars_made:2,total_votes:3,revenue_cents:'90071992547409930'};
 let signs=0;
 supabase.rpc=async(name,args)=>{assert.equal(name,'leaderboard_summary');assert.equal(args.p_period,'monthly');return {error:null,data:{
  period:'monthly',as_of:'2026-01-01T05:00:00Z',month_start:'2026-01-01T05:00:00Z',month_end:'2026-02-01T05:00:00Z',
  individuals:[individual],podium:[individual],monthly_top_avatars:[{rank:1,id:'image',contributor_id:'owner',name:'Full Name',avatar_path:individual.avatar_path,title:'Title',public_storage_path:'owner/image.webp',upvotes:3}],
  monthly_top_regions:[{rank:1,state_code:'NY',avatars_contributed:2,revenue_cents:'1000'}],monthly_rewards:[{rank:1,credits:2000}],next_cursor:{period:'monthly',as_of:'2026-01-01T05:00:00Z',rank:30},
 }};};
 supabase.storage.from=bucket=>({
  async createSignedUrl(path){assert.equal(bucket,'profile-photos');assert.equal(path,individual.avatar_path);signs++;return {data:{signedUrl:'https://fixture.supabase.co/signed-avatar'},error:null};},
  getPublicUrl(path){assert.equal(bucket,'gallery-photos');return {data:{publicUrl:`https://fixture.supabase.co/public/${path}`}};},
 });
 const result=await readLeaderboard('monthly');
 assert.equal(signs,1);assert.equal(result.individuals[0].revenue_cents,'90071992547409930');
 assert.equal(result.individuals[0].profile_photo_url,'https://fixture.supabase.co/signed-avatar');
 assert.equal(result.monthly_top_regions[0].state_name,'New York');
 assert.ok(!JSON.stringify(result).includes('avatar_path'));assert.ok(!JSON.stringify(result).includes('public_storage_path'));
 assert.deepEqual(decodeLeaderboardCursor(result.next_cursor,'monthly'),{period:'monthly',rank:30,as_of:'2026-01-01T05:00:00Z'});
});

test('missing profile photo objects fall back to initials; SQL failures surface safely',async()=>{
 supabase.rpc=async()=>({error:null,data:{period:'monthly',as_of:'2026-01-01T05:00:00Z',month_start:'2026-01-01T05:00:00Z',month_end:'2026-02-01T05:00:00Z',individuals:[{rank:1,contributor_id:'owner',name:'Full Name',avatar_path:'missing',avatars_made:1,total_votes:0,revenue_cents:'0'}],podium:[],monthly_top_avatars:[],monthly_top_regions:[],monthly_rewards:[],next_cursor:null}});
 supabase.storage.from=()=>({async createSignedUrl(){return {data:null,error:{message:'Not found'}};}});
 assert.equal((await readLeaderboard('monthly')).individuals[0].profile_photo_url,null);
 supabase.rpc=async()=>({data:null,error:{message:'Internal SQL details'}});
 await assert.rejects(readLeaderboard('monthly'),/Couldn’t load the leaderboard/);
});
