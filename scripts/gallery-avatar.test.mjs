import assert from 'node:assert/strict';
import { after, test } from 'node:test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'fixture-key';
const { supabase } = await import('../lib/supabase.ts');
const { readPublicAvatar } = await import('../lib/gallery-avatar.ts');
const originalFrom = supabase.from;
after(() => { supabase.from = originalFrom; });
const id = '11111111-1111-4111-8111-111111111111';
test('avatar details require publication and expose only public captions and image', async () => {
  const calls = [];
  supabase.from = table => {
    const call = { table, filters: [] }; calls.push(call);
    return { select(columns) { call.columns = columns; return this; },
      eq(...args) { call.filters.push(args); return this; },
      not(...args) { call.filters.push(args); return this; },
      async maybeSingle() { return { error: null, data: table === 'images' ? {id, title:'Hero', description:'Story', contributor_id:'owner', public_storage_path:'owner/public.webp'} : {first_name:'Test', last_name:'Creator'} }; },
    };
  };
  const avatar = await readPublicAvatar(id);
  assert.equal(avatar.name, 'Test Creator');
  assert.equal(avatar.description, 'Story');
  assert.deepEqual(calls[0].filters, [['id', id], ['published_at', 'is', null], ['public_storage_path', 'is', null]]);
  assert.ok(!calls[0].columns.includes('private_storage_path'));
  assert.ok(!('contributor_id' in avatar));
  assert.ok(!('public_storage_path' in avatar));
});
test('invalid or unpublished avatars return no public details', async () => {
  supabase.from = () => { throw new Error('Invalid IDs must not query'); };
  assert.equal(await readPublicAvatar('bad-id'), null);
  supabase.from = () => ({select(){return this;},eq(){return this;},not(){return this;},async maybeSingle(){return {data:null,error:null};}});
  assert.equal(await readPublicAvatar(id), null);
});
