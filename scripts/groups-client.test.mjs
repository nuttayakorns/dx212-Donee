import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createGroupRepository, groupFromRow } from '../lib/groups.js';
import { createTaskRepository } from '../lib/tasks.js';
function clientWith(responses) {
  const calls = [];
  const client = createClient('https://example.supabase.co', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const path = new URL(input).pathname.split('/').pop();
      calls.push({ path, body: JSON.parse(init.body || '{}') });
      const payload = responses[path];
      return new Response(JSON.stringify(payload), { status: payload?.code ? 403 : 200, headers: { 'content-type': 'application/json' } });
    } },
  });
  return { client, calls };
}

test('group DTO retains UUID members even when names are equal', () => {
  const group = groupFromRow({ id: 10, name: 'Team', members: [{id:'uuid-a',name:'Mint'},{id:'uuid-b',name:'Mint'}] });
  assert.equal(group.id,'10'); assert.equal(group.members.length,2); assert.notEqual(group.members[0].id,group.members[1].id);
});

test('create/join only send group name or invite code, not a forged user ID', async () => {
  const f = clientWith({ donee_create_group: {id:'10'}, donee_join_group:{id:'10',already_joined:true} });
  const repo = createGroupRepository(f.client);
  assert.equal(await repo.create('  Team  '),'10');
  assert.deepEqual(await repo.join(' abc123 '),{id:'10',alreadyJoined:true});
  assert.deepEqual(f.calls[0].body,{p_name:'Team'});
  assert.deepEqual(f.calls[1].body,{p_invite_code:'ABC123'});
});

test('assignment sends UUIDs rather than display names', async () => {
  const f = clientWith({donee_assign_group_tasks:1});
  await createGroupRepository(f.client).assign('10',[{task_id:'7',member_id:'uuid-b',member:'Mint',task:'Design'}]);
  assert.deepEqual(f.calls[0].body,{p_group_id:'10',p_assignments:[{task_id:'7',member_id:'uuid-b'}]});
});

test('group task CRUD uses checked RPCs and preserves database creator', async () => {
  const row={id:7,title:'Design',due_date:'2026-11-07T07:30:00Z',category:'Group',priority:'Medium',is_completed:false,user_id:'original-creator',group_id:10,assigned_to:'uuid-b'};
  const f = clientWith({donee_save_group_task:row,donee_complete_group_task:{...row,is_completed:true},donee_delete_group_task:true});
  const repo=createTaskRepository(f.client);
  const task=await repo.save({id:'7',persisted:true,title:'Design',date:'2026-11-07',time:'14:30',category:'Group',priority:'Medium',group_id:'10',done:false},'editing-member');
  assert.equal(task.user_id,'original-creator');assert.equal(task.group_id,'10');
  assert.equal(f.calls[0].body.p_task_id,'7');assert(!('user_id' in f.calls[0].body));
  assert.equal((await repo.complete(task,'editing-member')).done,true);
  await repo.remove(task.id,'editing-member',task.group_id);
  assert.deepEqual(f.calls.map(c=>c.path),['donee_save_group_task','donee_complete_group_task','donee_delete_group_task']);
});

test('rejected group operations do not report success', async () => {
  const f=clientWith({donee_join_group:{code:'42501',message:'Not allowed'}});
  await assert.rejects(()=>createGroupRepository(f.client).join('ABC123'),e=>e.code==='42501');
});
