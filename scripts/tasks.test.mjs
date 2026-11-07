import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createTaskRepository, taskFromRow, taskToRow, databaseMessage } from '../lib/tasks.js';

function fixture() {
  let rows = [], next = 1, reject = false;
  const requests = [];
  const fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = init.method || 'GET';
    requests.push({ method, query: url.searchParams });
    if (reject) return new Response(JSON.stringify({ code: '42501', message: 'new row violates row-level security policy' }), { status: 403 });
    const body = init.body ? JSON.parse(init.body) : null;
    const matches = row => ['id', 'user_id', 'group_id'].every(key => {
      const filter = url.searchParams.get(key);
      if (!filter) return true;
      return filter === 'is.null' ? row[key] == null : String(row[key]) === filter.slice(3);
    });
    let result;
    if (method === 'POST') {
      const row = { ...body, id: next++, created_at: new Date().toISOString() };
      rows.push(row); result = [row];
    } else {
      result = rows.filter(matches);
      if (method === 'PATCH') result.forEach(row => Object.assign(row, body));
      if (method === 'DELETE') rows = rows.filter(row => !matches(row));
    }
    const single = new Headers(init.headers).get('accept')?.includes('vnd.pgrst.object');
    return new Response(JSON.stringify(single ? result[0] : result), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const client = createClient('https://example.supabase.co', 'test-publishable-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch },
  });
  return { repo: createTaskRepository(client), requests, deny: () => { reject = true; } };
}
const form = { title: '  Read a book  ', date: '2026-11-07', time: '14:30', category: 'Study', priority: 'Medium', done: false };

test('date/time round trip and database defaults do not lose local due time', () => {
  const payload = taskToRow(form, 'user-a');
  const mapped = taskFromRow({ ...payload, id: 1 });
  assert.equal(mapped.date, form.date); assert.equal(mapped.time, form.time);
  assert.equal(mapped.title, 'Read a book'); assert.equal(mapped.persisted, true);
  assert.equal(payload.group_id, null); assert.equal(payload.assigned_to, null);
  assert.equal(taskFromRow({ id: 2, title: 'Undated', due_date: null }).date, '');
});

test('insert → fresh fetch → edit → toggle completion → delete', async () => {
  const { repo } = fixture();
  const saved = await repo.save(form, 'user-a');
  assert.equal(saved.id, '1'); assert.equal((await repo.list('user-a')).length, 1);
  const edited = await repo.save({ ...saved, title: 'Edited task' }, 'user-a');
  assert.equal(edited.title, 'Edited task');
  const complete = await repo.complete(edited, 'user-a'); assert.equal(complete.done, true);
  assert.equal((await repo.list('user-a'))[0].done, true);
  await repo.remove(saved.id, 'user-a'); assert.equal((await repo.list('user-a')).length, 0);
});

test('list uses database RLS; personal write queries still scope by owner and group', async () => {
  const { repo, requests } = fixture();
  const saved = await repo.save(form, 'user-a');
  await repo.save(form, 'user-b');
  assert.equal((await repo.list('user-a')).length, 2); // This HTTP fixture does not implement RLS; real RLS is tested in groups-db.test.mjs.
  await repo.complete(saved, 'user-a');
  await repo.remove(saved.id, 'user-a');
  for (const request of requests.filter(r => r.method === 'PATCH' || r.method === 'DELETE')) {
    assert.equal(request.query.get('group_id'), 'is.null');
    assert(request.query.get('user_id').startsWith('eq.'));
  }
});

test('failed RLS writes reject instead of reporting local success', async () => {
  const f = fixture(); f.deny();
  await assert.rejects(() => f.repo.save(form, 'user-a'), error => error.code === '42501');
  assert.match(databaseMessage({ code: '42501' }), /setup-tasks.sql/);
});

test('deleting an inaccessible/missing task reports failure', async () => {
  const { repo } = fixture();
  await assert.rejects(() => repo.remove('999', 'user-a'), /ลบงานไม่สำเร็จ/);
});
