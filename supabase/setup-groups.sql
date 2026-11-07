-- Donee: groups, invite codes, members, and group tasks.
-- Run after setup-tasks.sql, on the existing four tables. No table/data is deleted.
-- All mutations below check auth.uid() server-side. Group task writes use RPCs,
-- never a client-supplied creator UUID or unrestricted table access.
begin;
create schema if not exists donee_private;
revoke all on schema donee_private from public;
grant usage on schema donee_private to authenticated;

create unique index if not exists donee_group_members_user_group_idx
  on public.group_members(user_id, group_id);
create unique index if not exists donee_groups_invite_code_idx on public.groups(invite_code);
create unique index if not exists donee_groups_invite_code_case_idx on public.groups(upper(btrim(invite_code)));
create index if not exists donee_tasks_group_idx on public.tasks(group_id);
-- Existing group creators should also be group members.
insert into public.group_members(user_id, group_id)
select created_by, id from public.groups where created_by is not null
on conflict(user_id, group_id) do nothing;

create or replace function donee_private.is_member(p_group_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = (select auth.uid()));
$$;
revoke all on function donee_private.is_member(bigint) from public, anon;
grant execute on function donee_private.is_member(bigint) to authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.tasks enable row level security;
alter table public.profiles enable row level security;
revoke all on public.groups, public.group_members, public.tasks, public.profiles from anon;
revoke insert, update, delete on public.groups, public.group_members from authenticated;
grant select on public.groups, public.group_members to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update on public.profiles to authenticated;

-- Restrictive guards also protect against broad permissive policies left over
-- from experiments. Group writes are possible only through the checked RPCs.
drop policy if exists donee_groups_read on public.groups;
create policy donee_groups_read on public.groups for select to authenticated
  using (donee_private.is_member(id));
drop policy if exists donee_groups_read_guard on public.groups;
create policy donee_groups_read_guard on public.groups as restrictive for select to authenticated
  using (donee_private.is_member(id));
drop policy if exists donee_members_read on public.group_members;
create policy donee_members_read on public.group_members for select to authenticated
  using (donee_private.is_member(group_id));
drop policy if exists donee_members_read_guard on public.group_members;
create policy donee_members_read_guard on public.group_members as restrictive for select to authenticated
  using (donee_private.is_member(group_id));
drop policy if exists donee_profile_guard on public.profiles;
create policy donee_profile_guard on public.profiles as restrictive for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists donee_tasks_read_groups on public.tasks;
create policy donee_tasks_read_groups on public.tasks for select to authenticated
  using (group_id is not null and donee_private.is_member(group_id));
drop policy if exists donee_tasks_read_guard on public.tasks;
create policy donee_tasks_read_guard on public.tasks as restrictive for select to authenticated
  using ((group_id is null and user_id = (select auth.uid()))
    or (group_id is not null and donee_private.is_member(group_id)));
drop policy if exists donee_tasks_insert_guard on public.tasks;
create policy donee_tasks_insert_guard on public.tasks as restrictive for insert to authenticated
  with check (group_id is null and user_id = (select auth.uid()) and assigned_to is null);
drop policy if exists donee_tasks_update_guard on public.tasks;
create policy donee_tasks_update_guard on public.tasks as restrictive for update to authenticated
  using (group_id is null and user_id = (select auth.uid()))
  with check (group_id is null and user_id = (select auth.uid()) and assigned_to is null);
drop policy if exists donee_tasks_delete_guard on public.tasks;
create policy donee_tasks_delete_guard on public.tasks as restrictive for delete to authenticated
  using (group_id is null and user_id = (select auth.uid()));

-- Returns only groups the caller belongs to. Member payloads contain names/IDs,
-- not other people's email addresses or invite codes for unrelated groups.
create or replace function public.donee_list_groups()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'กรุณาเข้าสู่ระบบ' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', g.id::text, 'name', g.name, 'created_by', g.created_by,
    'invite_code', g.invite_code, 'created_at', g.created_at,
    'members', (select jsonb_agg(jsonb_build_object('id', m.user_id,
      'name', coalesce(nullif(p.username, ''), 'Member')) order by m.created_at, m.id)
      from public.group_members m join public.profiles p on p.id = m.user_id where m.group_id = g.id)
  ) order by g.created_at desc, g.id desc)
  from public.groups g where donee_private.is_member(g.id)), '[]'::jsonb);
end $$;

create or replace function public.donee_create_group(p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare new_group public.groups; code text; attempt integer;
begin
  if auth.uid() is null then raise exception 'กรุณาเข้าสู่ระบบ' using errcode = '42501'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 60 then raise exception 'ชื่อกลุ่มต้องมี 1–60 ตัวอักษร'; end if;
  if not exists(select 1 from public.profiles where id = auth.uid()) then raise exception 'กรุณาเข้าสู่ระบบใหม่เพื่อสร้างโปรไฟล์'; end if;
  for attempt in 1..8 loop
    code := upper(substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 12));
    insert into public.groups(name, created_by, invite_code)
      values(btrim(p_name), auth.uid(), code) on conflict do nothing returning * into new_group;
    if found then
      insert into public.group_members(user_id, group_id) values(auth.uid(), new_group.id)
        on conflict(user_id, group_id) do nothing;
      return jsonb_build_object('id', new_group.id::text);
    end if;
  end loop;
  raise exception 'สร้างรหัสเชิญไม่สำเร็จ กรุณาลองใหม่';
end $$;

create or replace function public.donee_join_group(p_invite_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.groups; added integer;
begin
  if auth.uid() is null then raise exception 'กรุณาเข้าสู่ระบบ' using errcode = '42501'; end if;
  if p_invite_code is null or btrim(p_invite_code) = '' then raise exception 'กรุณากรอกรหัสเชิญ'; end if;
  if not exists(select 1 from public.profiles where id = auth.uid()) then raise exception 'กรุณาเข้าสู่ระบบใหม่เพื่อสร้างโปรไฟล์'; end if;
  -- No public lookup/list endpoint. Match a full code only.
  select * into target from public.groups
    where upper(btrim(invite_code)) = upper(btrim(p_invite_code)) for share;
  if not found then raise exception 'รหัสเชิญไม่ถูกต้อง'; end if;
  insert into public.group_members(user_id, group_id) values(auth.uid(), target.id)
    on conflict(user_id, group_id) do nothing;
  get diagnostics added = row_count;
  return jsonb_build_object('id', target.id::text, 'already_joined', added = 0);
end $$;

create or replace function public.donee_save_group_task(
  p_group_id bigint, p_task_id bigint, p_title text, p_due_date timestamptz,
  p_category text, p_priority text, p_completed boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.tasks;
begin
  if auth.uid() is null or not donee_private.is_member(p_group_id) then raise exception 'คุณไม่ได้เป็นสมาชิกกลุ่มนี้' using errcode = '42501'; end if;
  perform 1 from public.groups where id = p_group_id for share;
  if p_title is null or length(btrim(p_title)) not between 1 and 120 then raise exception 'กรุณากรอกชื่องาน 1–120 ตัวอักษร'; end if;
  if p_priority is null or p_priority not in ('Low', 'Medium', 'High') then raise exception 'ระดับความสำคัญไม่ถูกต้อง'; end if;
  if p_task_id is null then
    insert into public.tasks(title, due_date, category, priority, is_completed, user_id, group_id)
      values(btrim(p_title), p_due_date, p_category, p_priority, coalesce(p_completed, false), auth.uid(), p_group_id)
      returning * into saved;
  else
    update public.tasks set title = btrim(p_title), due_date = p_due_date,
      category = p_category, priority = p_priority, is_completed = coalesce(p_completed, false)
      where id = p_task_id and group_id = p_group_id returning * into saved;
    if not found then raise exception 'ไม่พบงานในกลุ่มนี้'; end if;
  end if;
  return to_jsonb(saved);
end $$;

create or replace function public.donee_complete_group_task(p_group_id bigint, p_task_id bigint, p_completed boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.tasks;
begin
  if auth.uid() is null or not donee_private.is_member(p_group_id) then raise exception 'คุณไม่ได้เป็นสมาชิกกลุ่มนี้' using errcode = '42501'; end if;
  perform 1 from public.groups where id = p_group_id for share;
  update public.tasks set is_completed = coalesce(p_completed, false)
    where id = p_task_id and group_id = p_group_id returning * into saved;
  if not found then raise exception 'ไม่พบงานในกลุ่มนี้'; end if;
  return to_jsonb(saved);
end $$;

create or replace function public.donee_delete_group_task(p_group_id bigint, p_task_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not donee_private.is_member(p_group_id) then raise exception 'คุณไม่ได้เป็นสมาชิกกลุ่มนี้' using errcode = '42501'; end if;
  perform 1 from public.groups where id = p_group_id for share;
  delete from public.tasks where id = p_task_id and group_id = p_group_id;
  if not found then raise exception 'ไม่พบงานในกลุ่มนี้'; end if;
  return true;
end $$;

create or replace function public.donee_assign_group_tasks(p_group_id bigint, p_assignments jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare item jsonb; result_count integer; locked_count integer;
begin
  if auth.uid() is null or not donee_private.is_member(p_group_id) then raise exception 'คุณไม่ได้เป็นสมาชิกกลุ่มนี้' using errcode = '42501'; end if;
  if p_assignments is null or jsonb_typeof(p_assignments) <> 'array' then raise exception 'รายการมอบหมายไม่ถูกต้อง'; end if;
  result_count := jsonb_array_length(p_assignments);
  if result_count < 1 then raise exception 'กรุณาเลือกงานก่อนมอบหมาย'; end if;
  if result_count <> (select count(distinct value->>'task_id') from jsonb_array_elements(p_assignments)) then raise exception 'มีงานซ้ำในรายการมอบหมาย'; end if;
  -- Lock group and tasks in deterministic order. Reject stale/missing/completed
  -- tasks and roll back the entire batch rather than saving a partial result.
  perform 1 from public.groups where id = p_group_id for update;
  perform 1 from public.tasks t where t.group_id = p_group_id
    and t.id in (select (value->>'task_id')::bigint from jsonb_array_elements(p_assignments))
    and not t.is_completed order by t.id for update;
  get diagnostics locked_count = row_count;
  if locked_count <> result_count then raise exception 'งานเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่และสุ่มอีกครั้ง'; end if;
  for item in select value from jsonb_array_elements(p_assignments) loop
    if not exists(select 1 from public.group_members where group_id = p_group_id and user_id = (item->>'member_id')::uuid) then
      raise exception 'ผู้รับผิดชอบต้องเป็นสมาชิกกลุ่มนี้';
    end if;
  end loop;
  for item in select value from jsonb_array_elements(p_assignments) loop
    update public.tasks set assigned_to = (item->>'member_id')::uuid
      where group_id = p_group_id and id = (item->>'task_id')::bigint;
  end loop;
  return result_count;
end $$;

-- PostgreSQL grants EXECUTE to PUBLIC by default; revoke it for every RPC.
revoke all on function public.donee_list_groups() from public, anon;
revoke all on function public.donee_create_group(text) from public, anon;
revoke all on function public.donee_join_group(text) from public, anon;
revoke all on function public.donee_save_group_task(bigint,bigint,text,timestamptz,text,text,boolean) from public, anon;
revoke all on function public.donee_complete_group_task(bigint,bigint,boolean) from public, anon;
revoke all on function public.donee_delete_group_task(bigint,bigint) from public, anon;
revoke all on function public.donee_assign_group_tasks(bigint,jsonb) from public, anon;
grant execute on function public.donee_list_groups() to authenticated;
grant execute on function public.donee_create_group(text) to authenticated;
grant execute on function public.donee_join_group(text) to authenticated;
grant execute on function public.donee_save_group_task(bigint,bigint,text,timestamptz,text,text,boolean) to authenticated;
grant execute on function public.donee_complete_group_task(bigint,bigint,boolean) to authenticated;
grant execute on function public.donee_delete_group_task(bigint,bigint) to authenticated;
grant execute on function public.donee_assign_group_tasks(bigint,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
