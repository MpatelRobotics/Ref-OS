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
