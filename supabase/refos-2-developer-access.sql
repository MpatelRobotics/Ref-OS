-- Ref OS 2.0: Developer (Super Admin) access.
--
-- The Developer credential itself is NOT stored in the database or in this repository. It lives
-- only in the REFOS_SUPER_ADMIN_CODE Edge Function secret and is checked by the
-- refos-developer-access Edge Function. This file only adds how a Developer sign-in is recorded:
--
--   event_members.developer = true
--     Set ONLY by claim_developer_event_access(), which only the service role (the Edge Function)
--     can execute. The guard trigger below clears it on every other insert/update path, so no
--     browser, event Admin, normal access code, or role change can create or keep it.
--   Authorization is unchanged: a Developer row has role = 'admin', so every existing Admin
--   check (has_event_role, RLS policies, lifecycle guards) applies exactly as for any Admin.
--
-- Safe to re-run. Run AFTER refos-2-phase3-credential-claim-fix.sql and
-- admin-role-assignment.sql. If either of those files is re-run later, run this file again.

begin;

-- ---------------------------------------------------------------------------------------
-- 1. Developer flag on the existing event sign-in row
-- ---------------------------------------------------------------------------------------
alter table public.event_members add column if not exists developer boolean not null default false;

-- Only the trusted developer claim may set developer = true. Any other write:
--   INSERT -> false
--   UPDATE -> may keep an existing true only while the row stays the same user, event, and
--             role (e.g. a name update); it can always be cleared, never newly set.
create or replace function public.refos_event_members_developer_guard()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('refos.developer_claim', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.developer := false;
  else
    new.developer := coalesce(old.developer, false)
                     and coalesce(new.developer, false)
                     and new.role is not distinct from old.role
                     and new.user_id = old.user_id
                     and new.event_id = old.event_id;
  end if;
  return new;
end;
$$;

drop trigger if exists refos_event_members_developer_guard on public.event_members;
create trigger refos_event_members_developer_guard
before insert or update on public.event_members
for each row execute function public.refos_event_members_developer_guard();

-- ---------------------------------------------------------------------------------------
-- 2. Developer claim: service role only (called by the refos-developer-access Edge Function
--    after it has validated the credential against its secret and the attempt lockout).
-- ---------------------------------------------------------------------------------------
create or replace function public.claim_developer_event_access(p_event uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event is null or p_user is null then
    raise exception 'Event and user are required' using errcode = 'P0001';
  end if;
  -- Archived events keep refusing sign-ins (refos_archived_event_membership_guard still runs).
  perform set_config('refos.developer_claim', 'on', true);
  insert into public.event_members(event_id, user_id, role, name, developer)
  values (p_event, p_user, 'admin', 'Maharshi', true)
  on conflict (event_id, user_id)
  do update set role = 'admin', developer = true, name = 'Maharshi';
  perform set_config('refos.developer_claim', 'off', true);
end;
$$;

revoke all on function public.claim_developer_event_access(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_developer_event_access(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------------------
-- 2b. Attempt lockout for Developer checks: the SAME event_access_attempts table and rules as
--     restore/delete (8 failures within 5 minutes locks this device session for 5 minutes on
--     that event). Service role only.
-- ---------------------------------------------------------------------------------------
create or replace function public.refos_access_locked(p_event uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_access_attempts a
     where a.event_id = p_event and a.user_id = p_user
       and a.locked_until is not null and a.locked_until > now()
  );
$$;

create or replace function public.refos_access_attempt(p_event uuid, p_user uuid, p_ok boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.event_access_attempts%rowtype;
  v_failed int;
begin
  if p_ok then
    delete from public.event_access_attempts where event_id = p_event and user_id = p_user;
    return 'ok';
  end if;
  select * into v_attempt from public.event_access_attempts a
   where a.event_id = p_event and a.user_id = p_user
   for update;
  if v_attempt.user_id is null or v_attempt.window_started < now() - interval '5 minutes' then
    v_failed := 1;
    insert into public.event_access_attempts(event_id, user_id, failed_count, window_started, locked_until)
    values (p_event, p_user, 1, now(), null)
    on conflict (event_id, user_id)
    do update set failed_count = 1, window_started = now(), locked_until = null;
  else
    v_failed := v_attempt.failed_count + 1;
    update public.event_access_attempts
       set failed_count = v_failed,
           locked_until = case when v_failed >= 8 then now() + interval '5 minutes' else null end
     where event_id = p_event and user_id = p_user;
  end if;
  return case when v_failed >= 8 then 'locked' else 'invalid' end;
end;
$$;

revoke all on function public.refos_access_locked(uuid, uuid) from public, anon, authenticated;
revoke all on function public.refos_access_attempt(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.refos_access_locked(uuid, uuid) to service_role;
grant execute on function public.refos_access_attempt(uuid, uuid, boolean) to service_role;

-- ---------------------------------------------------------------------------------------
-- 3. Normal access codes always produce a normal sign-in (never Developer).
--    Same as refos-2-phase3-credential-claim-fix.sql, plus developer = false.
-- ---------------------------------------------------------------------------------------
create or replace function public.claim_event_access(
  p_event uuid,
  p_credential text
)
returns table(role text, is_admin boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_code text := upper(trim(coalesce(p_credential, '')));
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if v_code !~ '^[0-9][A-Z][0-9][0-9]$' then
    raise exception 'Invalid event credential';
  end if;

  select c.role
    into v_role
    from public.event_access_credentials c
   where c.event_id = p_event
     and c.enabled = true
     and c.credential_hash = encode(extensions.digest(v_code, 'sha256'::text), 'hex')
   limit 1;

  if v_role is null then
    raise exception 'Invalid event credential';
  end if;

  insert into public.event_members(event_id, user_id, role, developer)
  values (p_event, v_user, v_role, false)
  on conflict (event_id, user_id)
  do update set role = excluded.role, developer = false;

  return query
  select v_role, (v_role = 'admin');
end;
$$;

revoke all on function public.claim_event_access(uuid, text) from public, anon;
grant execute on function public.claim_event_access(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------
-- 4. Admin member list: include the developer flag so status screens can show "Developer".
--    (Return type changes, so the function is dropped and recreated.)
-- ---------------------------------------------------------------------------------------
drop function if exists public.list_event_members_for_admin(uuid);
create function public.list_event_members_for_admin(p_event uuid)
returns table(user_id uuid, name text, role text, developer boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication session required';
  end if;

  if not public.has_event_role(p_event, array['admin']) then
    raise exception 'Admin role required';
  end if;

  return query
    select m.user_id, m.name, m.role, m.developer
    from public.event_members m
    where m.event_id = p_event
    order by lower(coalesce(m.name, '')), m.user_id;
end;
$$;

revoke all on function public.list_event_members_for_admin(uuid) from public, anon;
grant execute on function public.list_event_members_for_admin(uuid) to authenticated;

commit;
