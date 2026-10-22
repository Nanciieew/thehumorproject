begin;
-- The database stores private object paths; image bytes stay in Supabase Storage.
-- Legacy records remain null because their original uploads were never retained.
alter table public.images add column if not exists original_storage_path text;
alter table public.factory_batches add column if not exists original_storage_path text;
update storage.buckets set allowed_mime_types = array(
  select distinct mime from unnest(coalesce(allowed_mime_types,array[]::text[]) || array['image/webp','image/jpeg','image/png']) as mime
) where id='generated-images';
commit;
