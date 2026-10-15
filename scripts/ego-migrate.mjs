// Run locally: node --env-file=.env.local scripts/ego-migrate.mjs [--apply]
// Secrets are read from the environment and never printed.
import { readFile } from 'node:fs/promises';
const apply=process.argv.includes('--apply');
try {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,token=process.env.SUPABASE_ACCESS_TOKEN;
 if(!url||!token)throw new Error('Configure a valid Supabase management access token and project URL in .env.local.');
 const ref=new URL(url).hostname.split('.')[0];
 async function query(sql,readOnly=true){const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:readOnly})});if(!r.ok)throw new Error(`Supabase management access failed (HTTP ${r.status}). No credentials have been printed.`);return r.json();}
 const rows=await query("select to_regclass('public.images') as images,to_regclass('public.ego_challenges') as challenges");
 if(!rows[0]?.images)throw new Error('Apply the existing image/gallery migrations first.');
 if(rows[0].challenges){console.log('Ego Check schema is already installed.');process.exit(0);}
 if(!apply){console.log('Ready. Run with --apply to install the tested Ego Check migration.');process.exit(0);}
 const sql=await readFile(new URL('../supabase/migrations/20261014000000_ego_check.sql',import.meta.url),'utf8');
 await query(sql,false);console.log('Ego Check migration installed. Existing photos and votes were preserved.');
}catch(e){console.error(e instanceof Error?e.message:'Migration failed.');process.exitCode=1;}
