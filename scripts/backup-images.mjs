// node --env-file=.env.local scripts/backup-images.mjs /private/tmp/images-backup.json
// Read-only, consistent snapshot. Refuses to overwrite an existing backup.
import { writeFile } from 'node:fs/promises';
const destination = process.argv[2];
if (!destination || !process.env.SUPABASE_ACCESS_TOKEN || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('Provide a backup destination, NEXT_PUBLIC_SUPABASE_URL and a valid SUPABASE_ACCESS_TOKEN.');
  process.exit(1);
}
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const candidates = ['images', 'generated_images', 'gallery_photos', 'work_captions', 'gallery_uploads', 'photo_votes'];
async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, read_only: true }), signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Supabase schema/backup query failed (HTTP ${response.status}).`);
  return response.json();
}
try {
  const existing = await query(`select table_name from information_schema.tables where table_schema='public'`);
  const names = candidates.filter(name => existing.some(table => table.table_name === name));
  if (!names.includes('images') && !names.includes('generated_images')) throw new Error('No image schema found; backup aborted.');
  const quotedNames = names.map(name => `'${name}'`).join(',');
  const [{ backup }] = await query(`select jsonb_build_object(
    ${names.map(name => `'${name}', (select coalesce(jsonb_agg(t), '[]'::jsonb) from public.${name} t)`).join(',')},
    'columns', (select jsonb_agg(t) from (
      select table_name, column_name, data_type, is_nullable, column_default
      from information_schema.columns where table_schema='public' and table_name in (${quotedNames})
      order by table_name, ordinal_position) t),
    'constraints', (select jsonb_agg(t) from (
      select c.relname as table_name, con.conname, pg_get_constraintdef(con.oid) as definition
      from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in (${quotedNames})) t)
  ) as backup`);
  const mismatch = (backup.gallery_photos ?? []).some(p => p.source === 'generated' && p.id !== p.generation_id);
  await writeFile(destination, JSON.stringify({ project: ref, captured_at: new Date().toISOString(), ...backup }, null, 2), { mode: 0o600, flag: 'wx' });
  for (const name of names) console.log(`${name}: ${backup[name].length} rows backed up`);
  if (mismatch) throw new Error('Backup saved, but generation/publication IDs differ. Resolve mapping before migration.');
  console.log('Backup saved with owner-only permissions. Compare its schema with the repository before cutover.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Backup failed.'); process.exitCode = 1;
}
