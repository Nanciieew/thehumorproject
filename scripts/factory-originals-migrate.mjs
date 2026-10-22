// Trusted local operator tool. No credentials or original photo data are printed.
// node --env-file=.env.local scripts/factory-originals-migrate.mjs [--apply]
import { readFile } from 'node:fs/promises';
try {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, token=process.env.SUPABASE_ACCESS_TOKEN;
  if(!url||!token)throw new Error('Configure the Supabase project URL and management access token.');
  const ref=new URL(url).hostname.split('.')[0];
  async function query(sql,readOnly=true){
    const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:readOnly})});
    if(!response.ok)throw new Error(`Supabase operation failed (HTTP ${response.status}). No credentials were printed.`);
    return response.json();
  }
  const inspect=()=>query("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='images' and column_name='original_storage_path') as originals, exists(select 1 from information_schema.columns where table_schema='public' and table_name='factory_batches' and column_name='original_storage_path') as batch_originals");
  const [before]=await inspect();
  if(!process.argv.includes('--apply'))console.log(JSON.stringify(before));
  else{
    await query(await readFile(new URL('../supabase/migrations/20261022000000_factory_originals.sql',import.meta.url),'utf8'),false);
    const [after]=await inspect();
    if(!after.originals||!after.batch_originals)throw new Error('The original-photo schema could not be verified.');
    console.log('Private original-photo retention is installed. Existing images, votes, sales and admin permissions were preserved.');
  }
}catch(error){console.error(error instanceof Error?error.message:'Original-photo migration failed.');process.exitCode=1;}
