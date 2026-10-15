// One real Seedream request using a synthetic illustrated face and a disposable account.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import sharp from 'sharp';
const base=process.env.DISGUISE_TEST_URL??'http://localhost:3011';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const check=r=>{assert.ifError(r.error);return r.data;};let userId;
try{
 const email=`ego-disguise-fixture-${randomUUID()}@example.com`,password=randomUUID()+randomUUID();
 userId=check(await admin.auth.admin.createUser({email,password,email_confirm:true})).user.id;
 const jar=new Map();const auth=createServerClient(url,process.env.SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
 check(await auth.auth.signInWithPassword({email,password}));
 check(await admin.from('profiles').insert({id:userId,first_name:'Disguise',last_name:'Ego Fixture',state_code:'NY',onboarding_completed_at:new Date().toISOString()}));
 const svg='<svg width="320" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="400" fill="#ddd7c5"/><ellipse cx="160" cy="185" rx="100" ry="130" fill="#e7b993"/><path d="M60 160Q50 10 160 30Q270 10 260 160L230 100L90 100Z" fill="#302b26"/><circle cx="125" cy="170" r="10"/><circle cx="195" cy="170" r="10"/><path d="M115 235Q160 270 205 235" stroke="#302b26" stroke-width="8" fill="none"/></svg>';
 const image=`data:image/jpeg;base64,${(await sharp(Buffer.from(svg)).jpeg().toBuffer()).toString('base64')}`;
 const body={purpose:'disguise',approved:true,image,prompt:'An original 3D cartoon character based on this simple illustrated face, teal jacket, dark plain background, one character portrait.'};
 const headers={origin:base,'Content-Type':'application/json',cookie:[...jar].map(([name,value])=>`${name}=${value}`).join('; ')};
 const denied=await fetch(`${base}/api/images`,{method:'POST',headers,body:JSON.stringify({...body,approved:false})});assert.equal(denied.status,400);
 const response=await fetch(`${base}/api/images`,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});
 const result=await response.json();assert.equal(response.status,200,result.error??'Generation failed.');
 const row=check(await admin.from('images').select('contributor_id,private_storage_path,public_storage_path,published_at').eq('id',result.generationId).single());
 assert.equal(row.contributor_id,userId);assert.ok(row.private_storage_path);assert.equal(row.public_storage_path,null);assert.equal(row.published_at,null);
 const preview=await fetch(result.url);assert.equal(preview.status,200);const meta=await sharp(Buffer.from(await preview.arrayBuffer())).metadata();assert.equal(meta.format,'webp');
 console.log('PASS: real Doubao Seedream transformation, explicit consent, private saving and working generated preview.');
}finally{
 if(userId){
  const files=check(await admin.storage.from('generated-images').list(userId,{limit:100}));
  if(files.length)check(await admin.storage.from('generated-images').remove(files.map(f=>`${userId}/${f.name}`)));
  check(await admin.auth.admin.deleteUser(userId));
  console.log('Disposable disguise account and generated images cleaned up.');
 }
}
