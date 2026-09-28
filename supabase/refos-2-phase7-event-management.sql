-- Ref OS 2.0 Phase 7: Event Management & Archiving
--
-- Archive status is lifecycle state only:
--   events.archived_at IS NULL      -> ACTIVE
--   events.archived_at IS NOT NULL  -> ARCHIVED (the timestamp is the archive date)
--
-- Archiving and restoring NEVER delete or change teams, matches, scores, rankings, skills,
-- alliances, violations, field logs, judging data, settings, branding, field names, or access
-- codes, and never change the event UUID. Nothing here cascades or deletes anything.
--
-- Highlander Summit (11111111-1111-4111-8111-111111111111) cannot be archived.
--
-- Safe to rerun.

-- ---------------------------------------------------------------------------
-- 1. Archive status column
-- ---------------------------------------------------------------------------
alter table public.events add column if not exists archived_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Guard: archived_at can only change through the Phase 7 functions below.
--    Admins have a direct UPDATE policy on events (used to rename an event), so without
--    this guard an Admin could set archived_at directly and skip the Highlander check.
-- ---------------------------------------------------------------------------
create or replace function public.guard_refos_event_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.archived_at is not null then
      raise exception 'New events must start active' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.archived_at is distinct from old.archived_at then
    if coalesce(current_setting('refos.lifecycle_change', true), '') <> 'on' then
      raise exception 'Event archive status can only be changed from Event Management' using errcode = 'P0001';
    end if;
    if new.archived_at is not null and new.id = '11111111-1111-4111-8111-111111111111'::uuid then
      raise exception 'Highlander Summit is a protected event and cannot be archived' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists refos_event_lifecycle_guard on public.events;
create trigger refos_event_lifecycle_guard
before insert or update on public.events
for each row execute function public.guard_refos_event_lifecycle();

-- ---------------------------------------------------------------------------
-- 3. Guard: no new sign-ins to an archived event.
--    Every Ref OS sign-in (claim_event_access) and Admin role change writes event_members,
--    so blocking new or changed memberships here stops the normal login workflow for an
--    archived event server-side, without redefining the login function.
--    Existing rows are never deleted or modified by this guard.
-- ---------------------------------------------------------------------------
create or replace function public.block_archived_event_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.events e
    where e.id = new.event_id and e.archived_at is not null
  ) then
    raise exception 'This event has been archived' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists refos_archived_event_membership_guard on public.event_members;
create trigger refos_archived_event_membership_guard
before insert or update on public.event_members
for each row execute function public.block_archived_event_membership();

-- ---------------------------------------------------------------------------
-- 4. Public lifecycle metadata for Choose VEX Event and Archived Events.
--    Works alongside list_refos_event_branding() (Phase 6), which supplies name and branding.
--    Exposes only event ID, archive date, and creation date. No credentials, members, or data.
-- ---------------------------------------------------------------------------
create or replace function public.list_refos_event_lifecycle()
returns table(
  event_id uuid,
  archived_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.archived_at, e.created_at
  from public.events e;
$$;

revoke all on function public.list_refos_event_lifecycle() from public;
grant execute on function public.list_refos_event_lifecycle() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Archive: only a signed-in Admin member of THAT event. Highlander is refused.
--    Changes only events.archived_at. Idempotent if already archived.
-- ---------------------------------------------------------------------------
create or replace function public.archive_refos_event(p_event uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_archived timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;

  if p_event = '11111111-1111-4111-8111-111111111111'::uuid
     or coalesce((
       select (s.value->>'protected')::boolean
       from public.event_settings s
       where s.event_id = p_event and s.key = 'system_protection'
     ), false) then
    raise exception 'This is a protected event and cannot be archived' using errcode = 'P0001';
  end if;

  if not public.has_event_role(p_event, array['admin']) then
    raise exception 'Only an Admin of this event can archive it' using errcode = 'P0001';
  end if;

  select e.archived_at into v_archived from public.events e where e.id = p_event;
  if not found then
    raise exception 'Event not found' using errcode = 'P0001';
  end if;
  if v_archived is not null then
    return v_archived;
  end if;

  perform set_config('refos.lifecycle_change', 'on', true);
  update public.events
     set archived_at = now()
   where id = p_event
  returning archived_at into v_archived;

  return v_archived;
end;
$$;

revoke all on function public.archive_refos_event(uuid) from public, anon;
grant execute on function public.archive_refos_event(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Restore: requires that event's Admin, verified server-side by EITHER
--      a) this session already holds Admin membership of the event, or
--      b) the event's enabled Admin access code (same format and hashing as login).
--    Failed codes count toward the existing event_access_attempts lockout
--    (8 failures in 5 minutes locks restore for 5 minutes on that session).
--    Returns 'restored', 'active' (already active), 'invalid', or 'locked'.
--    Invalid/locked are returned, not raised, so the failure count is kept.
--    Changes only events.archived_at. Same UUID; no data is touched.
-- ---------------------------------------------------------------------------
create or replace function public.restore_refos_event(p_event uuid, p_admin_credential text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_admin_credential, '')));
  v_archived timestamptz;
  v_ok boolean := false;
  v_attempt public.event_access_attempts%rowtype;
  v_failed int;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;

  select e.archived_at into v_archived from public.events e where e.id = p_event;
  if not found then
    raise exception 'Event not found' using errcode = 'P0001';
  end if;
  if v_archived is null then
    return 'active';
  end if;

  select * into v_attempt
    from public.event_access_attempts a
   where a.event_id = p_event and a.user_id = v_user;
  if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    return 'locked';
  end if;

  if public.has_event_role(p_event, array['admin']) then
    v_ok := true;
  elsif v_code ~ '^[0-9][A-Z][0-9][0-9]$' then
    v_ok := exists (
      select 1
        from public.event_access_credentials c
       where c.event_id = p_event
         and c.role = 'admin'
         and c.enabled = true
         and c.credential_hash = encode(extensions.digest(v_code, 'sha256'::text), 'hex')
    );
  end if;

  if not v_ok then
    if v_attempt.user_id is null or v_attempt.window_started < now() - interval '5 minutes' then
      v_failed := 1;
      insert into public.event_access_attempts(event_id, user_id, failed_count, window_started, locked_until)
      values (p_event, v_user, 1, now(), null)
      on conflict (event_id, user_id)
      do update set failed_count = 1, window_started = now(), locked_until = null;
    else
      v_failed := v_attempt.failed_count + 1;
      update public.event_access_attempts
         set failed_count = v_failed,
             locked_until = case when v_failed >= 8 then now() + interval '5 minutes' else null end
       where event_id = p_event and user_id = v_user;
    end if;
    return case when v_failed >= 8 then 'locked' else 'invalid' end;
  end if;

  delete from public.event_access_attempts
   where event_id = p_event and user_id = v_user;

  perform set_config('refos.lifecycle_change', 'on', true);
  update public.events
     set archived_at = null
   where id = p_event;

  return 'restored';
end;
$$;

revoke all on function public.restore_refos_event(uuid, text) from public, anon;
grant execute on function public.restore_refos_event(uuid, text) to authenticated;

-- ===========================================================================
-- 7. Permanent deletion of an ARCHIVED event
--
-- Lifecycle: ACTIVE -> ARCHIVE -> PERMANENT DELETE. Active events cannot be deleted.
-- Highlander Summit and events protected by the 'system_protection' setting can never be deleted.
-- ===========================================================================

-- 7a. Guard on the events table itself, so these rules hold for every delete path
--     (including the older configurator delete function and direct table deletes).
create or replace function public.guard_refos_event_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.id = '11111111-1111-4111-8111-111111111111'::uuid
     or coalesce((
       select (s.value->>'protected')::boolean
       from public.event_settings s
       where s.event_id = old.id and s.key = 'system_protection'
     ), false) then
    raise exception 'This is a protected event and cannot be deleted' using errcode = 'P0001';
  end if;
  if old.archived_at is null then
    raise exception 'Archive this event before deleting it permanently' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists refos_event_delete_guard on public.events;
create trigger refos_event_delete_guard
before delete on public.events
for each row execute function public.guard_refos_event_delete();

-- 7b. Permanent delete RPC.
--   Requires: signed-in session, an ARCHIVED event, not protected, the exact event name,
--   and EITHER the event's enabled Admin access code (same format and hashing as login and
--   restore) OR the Ref OS emergency deletion override code (hash only; delete-only).
--   Wrong codes count toward the existing event_access_attempts lockout
--   (8 failures in 5 minutes locks this session for 5 minutes), shared with restore.
--   Returns 'deleted', 'name_mismatch', 'invalid', or 'locked'. Refusals that must not be
--   retried (active, protected, not found) raise an error.
--
--   Atomic: runs in one transaction. Any error rolls back every delete.
--   Deletes every row belonging to the event from:
--     push_dispatches, push_subscriptions, device_status, feedback, awp_status,
--     field_reset_status, field_reset_checks, field_log, violations, nominations, shortlist,
--     watch_notes, alliances, matches, teams, rules, ref_roster, event_settings,
--     event_access_attempts, event_access_credentials, event_members,
--   then sweeps any other public table with an event_id column, then deletes the event row.
--   Every one of these tables also has ON DELETE CASCADE to events as a backstop.
create or replace function public.delete_archived_refos_event(
  p_event uuid,
  p_confirm_name text,
  p_admin_credential text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_admin_credential, '')));
  v_event public.events%rowtype;
  v_attempt public.event_access_attempts%rowtype;
  v_failed int;
  v_ok boolean := false;
  v_table text;
  v_known text[] := array[
    'push_dispatches', 'push_subscriptions', 'device_status', 'feedback', 'awp_status',
    'field_reset_status', 'field_reset_checks', 'field_log', 'violations', 'nominations',
    'shortlist', 'watch_notes', 'alliances', 'matches', 'teams', 'rules', 'ref_roster',
    'event_settings', 'event_access_attempts', 'event_access_credentials', 'event_members'
  ];
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;

  if p_event = '11111111-1111-4111-8111-111111111111'::uuid
     or coalesce((
       select (s.value->>'protected')::boolean
       from public.event_settings s
       where s.event_id = p_event and s.key = 'system_protection'
     ), false) then
    raise exception 'This is a protected event and cannot be deleted' using errcode = 'P0001';
  end if;

  select * into v_event from public.events e where e.id = p_event for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0001';
  end if;
  if v_event.archived_at is null then
    raise exception 'Archive this event before deleting it permanently' using errcode = 'P0001';
  end if;

  select * into v_attempt
    from public.event_access_attempts a
   where a.event_id = p_event and a.user_id = v_user;
  if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    return 'locked';
  end if;

  if trim(coalesce(p_confirm_name, '')) is distinct from trim(coalesce(v_event.name, '')) then
    return 'name_mismatch';
  end if;

  -- Authorization: this event's Admin access code, OR the Ref OS emergency deletion override.
  -- The override is stored only as a SHA-256 hash, exists only inside this function, and is
  -- checked only after the protected-event, archived-event, lockout, and exact-name checks above.
  -- It is not an event access credential: it cannot sign in, grant any role, unlock Event
  -- Settings or Event Management, restore an event, or delete an active or protected event.
  if v_code ~ '^[0-9][A-Z][0-9][0-9]$' then
    v_ok := exists (
      select 1
        from public.event_access_credentials c
       where c.event_id = p_event
         and c.role = 'admin'
         and c.enabled = true
         and c.credential_hash = encode(extensions.digest(v_code, 'sha256'::text), 'hex')
    )
    or encode(extensions.digest(v_code, 'sha256'::text), 'hex')
       = 'eff2e136933cf23f058b6c99d558a9f2a06d291bd8f505e56c176d085b6e84bf';
  end if;

  -- A wrong Admin/override code counts toward the same lockout as restore and login attempts.
  if not v_ok then
    if v_attempt.user_id is null or v_attempt.window_started < now() - interval '5 minutes' then
      v_failed := 1;
      insert into public.event_access_attempts(event_id, user_id, failed_count, window_started, locked_until)
      values (p_event, v_user, 1, now(), null)
      on conflict (event_id, user_id)
      do update set failed_count = 1, window_started = now(), locked_until = null;
    else
      v_failed := v_attempt.failed_count + 1;
      update public.event_access_attempts
         set failed_count = v_failed,
             locked_until = case when v_failed >= 8 then now() + interval '5 minutes' else null end
       where event_id = p_event and user_id = v_user;
    end if;
    return case when v_failed >= 8 then 'locked' else 'invalid' end;
  end if;

  -- Known event-scoped tables, children first.
  foreach v_table in array v_known loop
    if to_regclass('public.' || v_table) is not null then
      execute format('delete from public.%I where event_id = $1', v_table) using p_event;
    end if;
  end loop;

  -- Any other public table that stores an event_id (for example, one added after Phase 7).
  for v_table in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public'
       and c.column_name = 'event_id'
       and c.data_type = 'uuid'
       and t.table_type = 'BASE TABLE'
       and c.table_name <> all (v_known)
  loop
    execute format('delete from public.%I where event_id = $1', v_table) using p_event;
  end loop;

  delete from public.events where id = p_event;
  return 'deleted';
end;
$$;

revoke all on function public.delete_archived_refos_event(uuid, text, text) from public, anon;
grant execute on function public.delete_archived_refos_event(uuid, text, text) to authenticated;

-- ===========================================================================
-- 8. Emergency deletion from the event login screen (forgotten Admin code)
--
-- For an event whose Admin access code is lost, so nobody can sign in to archive it.
-- Authorization is ONLY the Ref OS emergency deletion override (hash only). Event access codes
-- of any role are not accepted here. The normal lifecycle rules are unchanged: this function
-- performs ACTIVE -> ARCHIVE -> PERMANENT DELETE itself, in one transaction, by archiving the
-- event and then calling the existing delete_archived_refos_event() above.
--
-- Checked BEFORE anything changes: signed-in session, not Highlander, not system-protected,
-- event exists, not locked out, exact event name, valid override. A wrong override counts toward
-- the same event_access_attempts lockout (8 failures in 5 minutes per session).
-- Returns 'deleted', 'name_mismatch', 'invalid', or 'locked'.
-- Atomic: if the delete does not complete, an error is raised and the archive is rolled back too.
-- ===========================================================================
create or replace function public.emergency_delete_refos_event(
  p_event uuid,
  p_confirm_name text,
  p_override_code text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_override_code, '')));
  v_event public.events%rowtype;
  v_attempt public.event_access_attempts%rowtype;
  v_failed int;
  v_result text;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;

  if p_event = '11111111-1111-4111-8111-111111111111'::uuid
     or coalesce((
       select (s.value->>'protected')::boolean
       from public.event_settings s
       where s.event_id = p_event and s.key = 'system_protection'
     ), false) then
    raise exception 'This is a protected event and cannot be deleted' using errcode = 'P0001';
  end if;

  select * into v_event from public.events e where e.id = p_event for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0001';
  end if;

  select * into v_attempt
    from public.event_access_attempts a
   where a.event_id = p_event and a.user_id = v_user;
  if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    return 'locked';
  end if;

  if trim(coalesce(p_confirm_name, '')) is distinct from trim(coalesce(v_event.name, '')) then
    return 'name_mismatch';
  end if;

  -- Override only. Same hash as the permanent-delete override; no event access code is accepted.
  if v_code !~ '^[0-9][A-Z][0-9][0-9]$'
     or encode(extensions.digest(v_code, 'sha256'::text), 'hex')
        <> 'eff2e136933cf23f058b6c99d558a9f2a06d291bd8f505e56c176d085b6e84bf' then
    if v_attempt.user_id is null or v_attempt.window_started < now() - interval '5 minutes' then
      v_failed := 1;
      insert into public.event_access_attempts(event_id, user_id, failed_count, window_started, locked_until)
      values (p_event, v_user, 1, now(), null)
      on conflict (event_id, user_id)
      do update set failed_count = 1, window_started = now(), locked_until = null;
    else
      v_failed := v_attempt.failed_count + 1;
      update public.event_access_attempts
         set failed_count = v_failed,
             locked_until = case when v_failed >= 8 then now() + interval '5 minutes' else null end
       where event_id = p_event and user_id = v_user;
    end if;
    return case when v_failed >= 8 then 'locked' else 'invalid' end;
  end if;

  -- Step 1: archive (only if still active), through the same lifecycle guard as Event Management.
  if v_event.archived_at is null then
    perform set_config('refos.lifecycle_change', 'on', true);
    update public.events set archived_at = now() where id = p_event;
  end if;

  -- Step 2 and 3: the existing permanent delete removes all event-scoped data and the event.
  v_result := public.delete_archived_refos_event(p_event, p_confirm_name, v_code);
  if v_result is distinct from 'deleted' then
    -- Undo the archive above; nothing is left changed.
    raise exception 'Emergency deletion did not complete (%)', v_result using errcode = 'P0001';
  end if;
  return 'deleted';
end;
$$;

revoke all on function public.emergency_delete_refos_event(uuid, text, text) from public, anon;
grant execute on function public.emergency_delete_refos_event(uuid, text, text) to authenticated;
