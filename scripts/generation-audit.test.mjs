import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { catalogSeedSql } from './generation-audit-migrate.mjs';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'fixture';
process.env.GEMINI_MODEL = 'fixture-gemini';
process.env.GEMINI_API_KEY = 'fixture-key';
process.env.ARK_API_KEY = 'fixture-ark';
const { supabase } = await import('../lib/supabase.ts');
const { auditedGeneration } = await import('../lib/ai/audit.ts');
const { generateRoast } = await import('../lib/roast/gemini.ts');
const { generateMemeCaptions } = await import('../lib/factory/captions.ts');
const { generateSeedreamOutput } = await import('../lib/seedream-generation.ts');
const db = new PGlite();
await db.exec('create schema auth; create table auth.users(id uuid primary key); create table public.images(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
const migration = async name => readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url),'utf8');
await db.exec(await migration('20261019000000_factory_batches'));
await db.exec(await migration('20261029000000_admin_catalog'));
const userId = randomUUID(), batchId = randomUUID(), legacyResponse = randomUUID();
await db.query('insert into auth.users values($1)',[userId]);
await db.query('insert into factory_batches(id,user_id) values($1,$2)',[batchId,userId]);
await db.query("insert into llm_responses(id,generation_request_id,provider,model,response) values($1,$2,'Google Gemini','old-model','{\"old\":true}')",[legacyResponse,batchId]);
const auditMigration = await migration('20261029000001_generation_audit');
await db.exec(auditMigration);
await db.exec(catalogSeedSql('fixture-gemini','doubao-seedream-5-0-flash-260915'));
const original = { rpc: supabase.rpc, fetch: globalThis.fetch };
let entries = [], failStart = false, failFinish = false;
supabase.rpc = (name,args) => ({ abortSignal: async () => {
  if (name === 'record_generation_start') {
    entries.push(args.p_entry);
    if (failStart) return { error: { code: 'fixture' } };
    const data = (await db.query('select record_generation_start($1::jsonb) as id',[JSON.stringify(args.p_entry)])).rows[0].id;
    return { data, error: null };
  }
  assert.equal(name,'record_generation_finish');
  if (failFinish) return { error: { code: 'fixture' } };
  await db.query('select record_generation_finish($1,$2::jsonb)',[args.p_id,JSON.stringify(args.p_result)]);
  return { data: null,error:null };
} });
after(async () => { supabase.rpc = original.rpc; globalThis.fetch = original.fetch; await db.close(); });
const context = { userId, source: 'getchecked', workflow: 'live_roast' };
const rows = async text => (await db.query(text)).rows;

test('legacy data survives, migration/seed repeat, and edits to catalog flags and mix survive reseeding', async () => {
  await db.exec(auditMigration);
  await db.exec("update prompt_chain_mix set weight=7,enabled=false; update llm_models set enabled=false;");
  await db.exec(catalogSeedSql('fixture-gemini','doubao-seedream-5-0-flash-260915'));
  assert.equal((await rows('select count(*)::int as n from generation_requests'))[0].n,2);
  assert.equal((await rows('select response from llm_responses'))[0].response.old,true);
  assert.ok((await rows('select weight,enabled from prompt_chain_mix')).every(r => Number(r.weight) === 7 && !r.enabled));
  assert.ok((await rows('select enabled from llm_models')).every(r => !r.enabled));
  assert.equal((await rows('select count(*)::int as n from prompt_chain_steps where llm_model_id is not null'))[0].n,5);
});
test('live roast calls persist actual prompts, viewer/request/session, model, usage, and public response atomically', async () => {
  const externalRequestId = randomUUID(), sessionId = randomUUID();
  const response = { candidates:[{content:{parts:[{thought:true,text:'private reasoning'},{text:JSON.stringify({ status:'ok',roast:'A fixture roast.',anchor:'face' })}]}}],usageMetadata:{promptTokenCount:11,candidatesTokenCount:7} };
  globalThis.fetch = async () => Response.json(response);
  await generateRoast({ requestId:externalRequestId, sessionId, settings:{intensity:'playful',excludedTopics:[],direction:'Finals'},events:[],frames:[{mimeType:'image/jpeg',base64:'aW1hZ2U=',capturedAtMs:1}] },[],new AbortController().signal,{...context,externalRequestId,sessionId});
  const [saved] = await db.query('select * from generation_requests where external_request_id=$1',[externalRequestId]).then(r=>r.rows);
  assert.equal(saved.user_id,userId); assert.equal(saved.status,'succeeded'); assert.equal(saved.session_id,sessionId);
  assert.equal(saved.request.contents[0].parts[1].inlineData.byteLength,5);
  assert.equal(saved.request.contents[0].parts[1].inlineData.sha256.length,64);
  assert.match(saved.request.systemInstruction.parts[0].text,/roast comedian/);
  assert.equal(saved.mix_snapshot.entry.enabled,false); assert.equal(Number(saved.mix_snapshot.entry.weight),7);
  const [output] = (await db.query('select * from llm_responses where request_id=$1',[saved.id])).rows;
  assert.equal(output.usage.promptTokenCount,11); assert.equal(output.http_status,200); assert.ok(output.duration_ms>=0);
  assert.equal(output.response.candidates[0].content.parts.length,1);
  assert.ok(!JSON.stringify(saved).includes('aW1hZ2U='));
  assert.equal(output.llm_model_id,saved.llm_model_id);
});
test('Factory initial and retry calls get separate request records linked to the same batch and ordered steps', async () => {
  globalThis.fetch = async () => Response.json({candidates:[{content:{parts:[{text:JSON.stringify({captions:['One caption','Two captions','Three captions','Four captions','Five captions']})}]}}]});
  for (let attempt=0;attempt<2;attempt++) await generateMemeCaptions('data:image/jpeg;base64,aW1hZ2U=','Finals',undefined,attempt>0,{userId,source:'factory',workflow:'factory_captions',factoryBatchId:batchId,stepPosition:attempt,attempt:attempt+1});
  const requests = (await db.query("select * from generation_requests where source='factory' order by attempt")).rows;
  assert.equal(requests.length,2); assert.notEqual(requests[0].id,requests[1].id);
  assert.equal(requests[0].factory_batch_id,batchId); assert.equal(requests[1].prompt_snapshot.position,1);
  assert.match(requests[1].request.contents[0].parts[0].text,/revision/);
  const freshBatch = randomUUID();
  await db.query("insert into factory_batches(id,user_id,state) values($1,$2,'ready')",[freshBatch,userId]);
  await generateMemeCaptions('data:image/jpeg;base64,aW1hZ2U=','Finals',undefined,false,{userId,source:'factory',workflow:'factory_captions',factoryBatchId:freshBatch});
  const before = (await rows('select count(*)::int as n from generation_requests'))[0].n;
  await db.exec(auditMigration);
  assert.equal((await rows('select count(*)::int as n from generation_requests'))[0].n,before,'rerunning migration does not invent legacy rows for calls already audited');
});
test('image calls retain prompt and reference metadata with Ark usage', async () => {
  globalThis.fetch = async () => Response.json({data:[{url:'https://fixture.example/output.webp'}],usage:{generated_images:1}});
  assert.equal(await generateSeedreamOutput('A clay spaceship.','data:image/png;base64,aW1hZ2U=',undefined,{userId,source:'admin_media'}),'https://fixture.example/output.webp');
  const [saved] = await rows("select request from generation_requests where source='admin_media'");
  assert.equal(saved.request.prompt,'A clay spaceship.'); assert.equal(saved.request.image.content,'omitted');
});
test('quota, malformed output, network failure, and cancellation are retained as failed/cancelled calls', async () => {
  for (const [run,expected] of [
    [async () => { globalThis.fetch=async()=>Response.json({error:{code:'Quota'}},{status:429}); return generateSeedreamOutput('Quota',undefined,undefined,{userId,source:'quota'}); },'failed'],
    [async () => { globalThis.fetch=async()=>Response.json({data:[]}); return generateSeedreamOutput('Empty',undefined,undefined,{userId,source:'empty'}); },'failed'],
    [async () => { globalThis.fetch=async()=>new Response('Provider temporarily unavailable',{status:503}); return generateSeedreamOutput('Unavailable',undefined,undefined,{userId,source:'plain_error'}); },'failed'],
    [() => auditedGeneration({context,provider:'Google Gemini',model:'fixture-gemini',request:{}},async()=>{throw new Error('Network');}),'failed'],
    [() => auditedGeneration({context,provider:'Google Gemini',model:'fixture-gemini',request:{}},async()=>{throw new DOMException('Cancelled','AbortError');}),'cancelled'],
  ]) {
    await assert.rejects(run());
    const id=entries.at(-1).id;
    assert.equal((await db.query('select status from generation_requests where id=$1',[id])).rows[0].status,expected);
    assert.equal((await db.query('select count(*)::int as n from llm_responses where request_id=$1',[id])).rows[0].n,1);
  }
  assert.equal((await rows("select r.response from llm_responses r join generation_requests q on q.id=r.request_id where q.source='plain_error'"))[0].response.raw_text,'Provider temporarily unavailable');
});
test('logging failure before dispatch prevents inference, and completion failure leaves a visible running record', async () => {
  let called=0; failStart=true;
  try { await assert.rejects(auditedGeneration({context,provider:'Google Gemini',model:'fixture-gemini',request:{}},async()=>{called++;}),/logging is unavailable/); }
  finally { failStart=false; }
  assert.equal(called,0);
  failFinish=true;
  try { await assert.rejects(auditedGeneration({context,provider:'Google Gemini',model:'fixture-gemini',request:{}},async()=>{called++;return 'ok';}),/logging is unavailable/); }
  finally { failFinish=false; }
  assert.equal(called,1);
  assert.equal((await db.query('select status from generation_requests where id=$1',[entries.at(-1).id])).rows[0].status,'running');
});
test('finish is idempotent, request snapshots survive later catalog edits, and secrets are redacted', async () => {
  await auditedGeneration({context,provider:'Google Gemini',model:'fixture-gemini',request:{authorization:'secret',apiKey:'secret',prompt:'Keep this prompt'}},async capture=>{capture({response:{text:'ok'},httpStatus:200});});
  const id=entries.at(-1).id;
  await db.query('select record_generation_finish($1,$2::jsonb)',[id,JSON.stringify({status:'failed',response:{}})]);
  await db.exec('update prompt_chain_mix set weight=9;');
  const [saved] = (await db.query('select * from generation_requests where id=$1',[id])).rows;
  assert.equal(Number(saved.mix_snapshot.entry.weight),7); assert.equal(saved.status,'succeeded');
  assert.equal(saved.request.apiKey,'[redacted]'); assert.equal(saved.request.prompt,'Keep this prompt');
  assert.equal((await db.query('select count(*)::int as n from llm_responses where request_id=$1',[id])).rows[0].n,1);
});
test('anonymous and ordinary users cannot read/write audit records or execute recording RPCs', async () => {
  for (const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(db.query('select * from generation_requests'),/permission denied/);
      await assert.rejects(db.query("select record_generation_start('{}')"),/permission denied/);
      await assert.rejects(db.query("select record_generation_finish($1,'{}')",[randomUUID()]),/permission denied/);
    } finally { await db.exec('reset role'); }
  }
});
