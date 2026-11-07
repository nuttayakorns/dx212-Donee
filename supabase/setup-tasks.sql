-- Donee: run once in Supabase Dashboard → SQL Editor for this project's existing tables.
-- This enables authenticated users to manage ONLY their own profile and personal tasks.
-- It does not enable public/anonymous access and does not change groups or memberships.
begin;
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;

-- Identity/serial task IDs need sequence access for INSERT.
do $$
declare task_sequence text;
begin
  task_sequence := pg_get_serial_sequence('public.tasks', 'id');
  if task_sequence is not null then
    execute format('grant usage, select on sequence %s to authenticated', task_sequence);
  end if;
end $$;

-- Re-running this script replaces only Donee's own named policies.
drop policy if exists donee_profiles_select_self on public.profiles;
create policy donee_profiles_select_self on public.profiles for select to authenticated
  using (id = (select auth.uid()));
drop policy if exists donee_profiles_insert_self on public.profiles;
create policy donee_profiles_insert_self on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
drop policy if exists donee_profiles_update_self on public.profiles;
create policy donee_profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists donee_tasks_select_self on public.tasks;
create policy donee_tasks_select_self on public.tasks for select to authenticated
  using (user_id = (select auth.uid()) and group_id is null);
drop policy if exists donee_tasks_insert_self on public.tasks;
create policy donee_tasks_insert_self on public.tasks for insert to authenticated
  with check (user_id = (select auth.uid()) and group_id is null and assigned_to is null);
drop policy if exists donee_tasks_update_self on public.tasks;
create policy donee_tasks_update_self on public.tasks for update to authenticated
  using (user_id = (select auth.uid()) and group_id is null)
  with check (user_id = (select auth.uid()) and group_id is null and assigned_to is null);
drop policy if exists donee_tasks_delete_self on public.tasks;
create policy donee_tasks_delete_self on public.tasks for delete to authenticated
  using (user_id = (select auth.uid()) and group_id is null);
commit;

-- Review other pre-existing policies here. PostgreSQL permissive policies combine with OR:
-- a broad old policy can still grant broader access. This script never silently drops yours.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' and tablename in ('profiles', 'tasks')
order by tablename, policyname;
