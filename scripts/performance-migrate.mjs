// node --env-file=.env.local scripts/performance-migrate.mjs [--apply]
// Uses existing credentials; never logs secrets or database contents.
import { readFile } from 'node:fs/promises';
try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!url || !token) throw new Error('Configure the Supabase URL and management access token first.');
  const ref = new URL(url).hostname.split('.')[0];
  async function query(sql, readOnly = true) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql, read_only: readOnly }),
    });
    if (!response.ok) throw new Error(`Supabase management request failed (HTTP ${response.status}). No credentials were printed.`);
    return response.json();
  }
  const [row] = await query("select to_regclass('public.images') as images, to_regprocedure('public.owned_works_page(uuid,text,jsonb,integer)') as works");
  if (!row?.images) throw new Error('Apply the existing image/gallery schema first.');
  if (row.works) { console.log('Checkboard pagination is already installed.'); }
  else if (!process.argv.includes('--apply')) console.log('Ready to install Checkboard pagination. Use --apply after tests pass.');
  else {
    await query(await readFile(new URL('../supabase/migrations/20261020000000_owned_works_page.sql', import.meta.url), 'utf8'), false);
    console.log('Checkboard pagination installed. Existing images and votes were preserved.');
  }
} catch (error) { console.error(error instanceof Error ? error.message : 'Migration failed.'); process.exitCode = 1; }
