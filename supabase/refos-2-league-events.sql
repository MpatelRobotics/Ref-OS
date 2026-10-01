-- Ref OS 2.0: League events.
--
-- Adds a second event format. Every existing event (including Highlander Summit) stays a
-- Tournament: the new column defaults to 'tournament' and nothing else about existing rows changes.
--
--   Tournament  one event, one schedule (unchanged behaviour).
--   League      one event that contains several league sessions (Session 1, Session 2, ...,
--               League Finals). Teams, rules, access codes, volunteer profiles and branding are
--               league-wide. Operational records made during a session belong to that session.
--
-- Session-scoped tables get a nullable session_id (NULL for tournaments). Tables whose key
-- included a match number, seed or award also get a generated session_key, so Session 1 Q1 and
-- Session 2 Q1 are different matches while tournament keys are unchanged.
--
-- Run after schema.sql, refos-2-phase7-event-management.sql and
-- refos-2-default-rules-template.sql. Safe to re-run.
--
-- IMPORTANT: run this file and deploy the matching Ref OS build together. Devices still running an
-- older build cannot save match schedules, alliances, field-reset checks or award finalists after
-- this file runs, until they refresh to the new build.

begin;

-- ---------------------------------------------------------------------------
-- 1. Event format
-- ---------------------------------------------------------------------------
alter table public.events add column if not exists event_format text not null default 'tournament';
alter table public.events drop constraint if exists events_event_format_check;
alter table public.events add constraint events_event_format_check check (event_format in ('tournament', 'league'));

-- The format is chosen when the event is created and cannot be changed afterwards
-- (changing it would orphan or mix session data). Highlander Summit is always a Tournament.
create or replace function public.guard_refos_event_format()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.event_format is distinct from old.event_format then
    if coalesce(current_setting('refos.format_change', true), '') <> 'on' then
      raise exception 'The event format cannot be changed after the event is created' using errcode = 'P0001';
    end if;
    if new.id = '11111111-1111-4111-8111-111111111111'::uuid and new.event_format <> 'tournament' then
      raise exception 'Highlander Summit is a Tournament event' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists refos_event_format_guard on public.events;
create trigger refos_event_format_guard
before update of event_format on public.events
for each row execute function public.guard_refos_event_format();

-- ---------------------------------------------------------------------------
-- 2. League sessions
-- ---------------------------------------------------------------------------
create table if not exists public.league_sessions (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  name         text not null,
  session_type text not null default 'session',
  ord          int  not null default 1,
  session_date date,
  start_time   time,
  end_time     time,
  status       text not null default 'upcoming',
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint league_sessions_event_id_key unique (event_id, id),
  constraint league_sessions_name_check check (length(trim(name)) between 1 and 80),
  constraint league_sessions_type_check check (session_type in ('session', 'finals')),
  constraint league_sessions_status_check check (status in ('upcoming', 'active', 'completed'))
);
-- Only one Active session per league.
create unique index if not exists league_sessions_one_active on public.league_sessions(event_id) where status = 'active';
create index if not exists league_sessions_event_ord_idx on public.league_sessions(event_id, ord);
alter table public.league_sessions enable row level security;

drop policy if exists "members read league sessions" on public.league_sessions;
create policy "members read league sessions" on public.league_sessions for select
  using (public.has_event_role(event_id, array['ref','judge','emcee','inspection','admin']));
-- No write policies: sessions change only through the Admin functions below.
revoke insert, update, delete on table public.league_sessions from anon, authenticated;
grant select on table public.league_sessions to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Per-session team attendance (teams themselves stay league-wide)
-- ---------------------------------------------------------------------------
create table if not exists public.league_session_attendance (
  event_id   uuid not null references public.events(id) on delete cascade,
  session_id uuid not null,
  team       text not null,
  status     text not null,
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (event_id, session_id, team),
  constraint league_session_attendance_status_check check (status in ('present', 'absent')),
  constraint league_session_attendance_session_fkey foreign key (event_id, session_id)
    references public.league_sessions(event_id, id) on delete cascade
);
alter table public.league_session_attendance enable row level security;
drop policy if exists "members read league attendance" on public.league_session_attendance;
drop policy if exists "refs write league attendance" on public.league_session_attendance;
create policy "members read league attendance" on public.league_session_attendance for select
  using (public.has_event_role(event_id, array['ref','judge','emcee','inspection','admin']));
create policy "refs write league attendance" on public.league_session_attendance for all
  using (public.has_event_role(event_id, array['ref','admin']))
  with check (public.has_event_role(event_id, array['ref','admin']));

-- ---------------------------------------------------------------------------
-- 4. session_id on session-scoped tables
--    matches, violations, field_log, field_reset_checks, alliances, nominations, shortlist.
--    NULL for every tournament row (all existing rows). The foreign key includes event_id, so a
--    record can only point at a session of its own event.
-- ---------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  foreach v_table in array array['matches','violations','field_log','field_reset_checks','alliances','nominations','shortlist'] loop
    execute format('alter table public.%I add column if not exists session_id uuid', v_table);
    if not exists (select 1 from pg_constraint where conname = v_table || '_league_session_fkey' and conrelid = ('public.' || v_table)::regclass) then
      execute format(
        'alter table public.%I add constraint %I foreign key (event_id, session_id) references public.league_sessions(event_id, id) on delete cascade',
        v_table, v_table || '_league_session_fkey');
    end if;
    execute format('create index if not exists %I on public.%I(event_id, session_id)', v_table || '_event_session_idx', v_table);
  end loop;
end $$;

-- Keys that must include the session. session_key is the session id, or the all-zero UUID for
-- tournaments, so existing tournament keys keep exactly the same identity.
do $$
declare
  v_spec text[];
  v_table text;
  v_cols text;
  v_pk text;
begin
  foreach v_spec slice 1 in array array[
    array['matches',            'event_id, session_key, phase, num'],
    array['field_reset_checks', 'event_id, session_key, match_id, quadrant'],
    array['alliances',          'event_id, session_key, seed'],
    array['shortlist',          'event_id, session_key, award, team']
  ] loop
    v_table := v_spec[1];
    v_cols := v_spec[2];
    execute format(
      'alter table public.%I add column if not exists session_key uuid generated always as (coalesce(session_id, ''00000000-0000-0000-0000-000000000000''::uuid)) stored',
      v_table);
    select c.conname into v_pk from pg_constraint c where c.conrelid = ('public.' || v_table)::regclass and c.contype = 'p';
    if v_pk is null or not exists (
      select 1 from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
       where c.conrelid = ('public.' || v_table)::regclass and c.contype = 'p' and a.attname = 'session_key'
    ) then
      if v_pk is not null then
        execute format('alter table public.%I drop constraint %I', v_table, v_pk);
      end if;
      execute format('alter table public.%I add primary key (%s)', v_table, v_cols);
    end if;
  end loop;
end $$;

-- Safety net for League events: a session-scoped row written without a session (for example by a
-- device still running an older build) is placed in the league's Active session, and refused when
-- no session is Active, so it can never land in an arbitrary session. Tournament rows are untouched.
create or replace function public.refos_assign_league_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_format text;
  v_session uuid;
begin
  if new.session_id is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.session_id is not null then
    new.session_id := old.session_id;
    return new;
  end if;
  select e.event_format into v_format from public.events e where e.id = new.event_id;
  if v_format is distinct from 'league' then
    return new;
  end if;
  -- League-wide field log entries (volunteer profiles, access-code requests, sync tests).
  if tg_table_name = 'field_log' then
    if new.kind in ('role_code_update', 'role_code_request', 'volunteer_contact', 'sync_probe', 'sync_ack', 'system_test') then
      return new;
    end if;
  end if;
  select s.id into v_session from public.league_sessions s where s.event_id = new.event_id and s.status = 'active';
  if v_session is null then
    raise exception 'This league has no active session. An Admin must start a session first.' using errcode = 'P0001';
  end if;
  new.session_id := v_session;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['matches','violations','field_log','field_reset_checks','alliances','nominations','shortlist'] loop
    execute format('drop trigger if exists refos_assign_league_session on public.%I', v_table);
    execute format(
      'create trigger refos_assign_league_session before insert or update on public.%I for each row execute function public.refos_assign_league_session()',
      v_table);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Create an event with a format (Tournament or League)
--    Wraps create_refos_vex_event, so a League gets the same default rules as a Tournament
--    (one rule set for the whole league, never one per session).
-- ---------------------------------------------------------------------------
create or replace function public.create_refos_vex_event_with_format(
  p_name text,
  p_admin_credential text,
  p_format text default 'tournament'
)
returns setof public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_format text := lower(trim(coalesce(p_format, 'tournament')));
begin
  if v_format not in ('tournament', 'league') then
    raise exception 'Event format must be Tournament or League.' using errcode = 'P0001';
  end if;
  select * into v_event from public.create_refos_vex_event(p_name, p_admin_credential) limit 1;
  if v_format = 'league' then
    perform set_config('refos.format_change', 'on', true);
    update public.events set event_format = 'league' where id = v_event.id returning * into v_event;
    perform set_config('refos.format_change', 'off', true);
  end if;
  return next v_event;
end;
$$;

revoke all on function public.create_refos_vex_event_with_format(text, text, text) from public, anon;
grant execute on function public.create_refos_vex_event_with_format(text, text, text) to authenticated;

-- Public, display-only: format and the active session name for Choose VEX Event.
create or replace function public.list_refos_event_formats()
returns table(event_id uuid, event_format text, active_session_name text, session_count int)
language sql
stable
security definer
set search_path = public
as $$
  select e.id,
         e.event_format,
         (select s.name from public.league_sessions s where s.event_id = e.id and s.status = 'active' limit 1),
         (select count(*)::int from public.league_sessions s where s.event_id = e.id)
  from public.events e;
$$;

revoke all on function public.list_refos_event_formats() from public;
grant execute on function public.list_refos_event_formats() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Session management (Admin / Developer only)
-- ---------------------------------------------------------------------------
create or replace function public.refos_require_league_admin(p_event uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;
  if not public.has_event_role(p_event, array['admin']) then
    raise exception 'Admin role required' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.events e where e.id = p_event and e.event_format = 'league') then
    raise exception 'This event is not a League' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.events e where e.id = p_event and e.archived_at is not null) then
    raise exception 'This event has been archived' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.refos_require_league_admin(uuid) from public, anon, authenticated;

create or replace function public.create_league_session(
  p_event uuid,
  p_name text,
  p_type text default 'session',
  p_date date default null,
  p_start time default null,
  p_end time default null
)
returns public.league_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.league_sessions%rowtype;
  v_type text := lower(trim(coalesce(p_type, 'session')));
begin
  perform public.refos_require_league_admin(p_event);
  if v_type not in ('session', 'finals') then
    raise exception 'Session type must be League Session or League Finals' using errcode = 'P0001';
  end if;
  insert into public.league_sessions(event_id, name, session_type, ord, session_date, start_time, end_time)
  values (
    p_event, trim(coalesce(p_name, '')), v_type,
    coalesce((select max(s.ord) from public.league_sessions s where s.event_id = p_event), 0) + 1,
    p_date, p_start, p_end
  )
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_league_session(
  p_session uuid,
  p_name text,
  p_type text,
  p_date date,
  p_start time,
  p_end time
)
returns public.league_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.league_sessions%rowtype;
  v_type text := lower(trim(coalesce(p_type, 'session')));
begin
  select * into v_row from public.league_sessions where id = p_session;
  if v_row.id is null then
    raise exception 'Session not found' using errcode = 'P0001';
  end if;
  perform public.refos_require_league_admin(v_row.event_id);
  if v_type not in ('session', 'finals') then
    raise exception 'Session type must be League Session or League Finals' using errcode = 'P0001';
  end if;
  update public.league_sessions
     set name = trim(coalesce(p_name, '')), session_type = v_type, session_date = p_date,
         start_time = p_start, end_time = p_end, updated_at = now()
   where id = p_session
  returning * into v_row;
  return v_row;
end;
$$;

-- p_order lists every session of the league in the new order.
create or replace function public.reorder_league_sessions(p_event uuid, p_order uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  perform public.refos_require_league_admin(p_event);
  select count(*) into v_count from public.league_sessions where event_id = p_event;
  if coalesce(array_length(p_order, 1), 0) <> v_count
     or (select count(distinct x) from unnest(p_order) x) <> v_count
     or exists (select 1 from unnest(p_order) x where not exists (
          select 1 from public.league_sessions s where s.id = x and s.event_id = p_event)) then
    raise exception 'The new order must list every session of this league exactly once' using errcode = 'P0001';
  end if;
  update public.league_sessions s
     set ord = o.pos, updated_at = now()
    from unnest(p_order) with ordinality as o(id, pos)
   where s.id = o.id and s.event_id = p_event;
end;
$$;

-- Start (active), Complete (completed) or return to Upcoming. Starting a session completes any
-- other Active session, so only one session is ever Active.
create or replace function public.set_league_session_status(p_session uuid, p_status text)
returns public.league_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.league_sessions%rowtype;
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  select * into v_row from public.league_sessions where id = p_session;
  if v_row.id is null then
    raise exception 'Session not found' using errcode = 'P0001';
  end if;
  perform public.refos_require_league_admin(v_row.event_id);
  if v_status not in ('upcoming', 'active', 'completed') then
    raise exception 'Invalid session status' using errcode = 'P0001';
  end if;
  if v_status = 'active' then
    update public.league_sessions
       set status = 'completed', completed_at = coalesce(completed_at, now()), updated_at = now()
     where event_id = v_row.event_id and status = 'active' and id <> p_session;
  end if;
  update public.league_sessions
     set status = v_status,
         started_at = case when v_status = 'active' then coalesce(started_at, now()) else started_at end,
         completed_at = case when v_status = 'completed' then now() when v_status = 'active' then null else completed_at end,
         updated_at = now()
   where id = p_session
  returning * into v_row;
  return v_row;
end;
$$;

-- Counts of the records stored in a session (shown before a destructive delete).
create or replace function public.league_session_record_counts(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event uuid;
  v_result jsonb;
begin
  select event_id into v_event from public.league_sessions where id = p_session;
  if v_event is null then
    raise exception 'Session not found' using errcode = 'P0001';
  end if;
  if not public.has_event_role(v_event, array['admin']) then
    raise exception 'Admin role required' using errcode = 'P0001';
  end if;
  select jsonb_build_object(
    'matches',      (select count(*) from public.matches where session_id = p_session),
    'violations',   (select count(*) from public.violations where session_id = p_session),
    'field_log',    (select count(*) from public.field_log where session_id = p_session),
    'nominations',  (select count(*) from public.nominations where session_id = p_session),
    'alliances',    (select count(*) from public.alliances where session_id = p_session),
    'attendance',   (select count(*) from public.league_session_attendance where session_id = p_session),
    'robot_photos', (select count(*) from public.teams t cross join lateral unnest(coalesce(t.photo_paths, '{}'::text[])) p(path)
                      where t.event_id = v_event and p.path like '%/s-' || p_session::text || '/%'),
    'snapshots',    (select count(*) from public.event_settings where event_id = v_event and key like '%@' || p_session::text)
  ) into v_result;
  return v_result;
end;
$$;

-- Deletes a session. A session holding any records (or one that was ever started) is deleted only
-- when p_confirm_name matches the session name exactly. Returns the storage paths (violation and
-- robot photos) the browser must remove from the robot-photos bucket.
create or replace function public.delete_league_session(p_session uuid, p_confirm_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.league_sessions%rowtype;
  v_counts jsonb;
  v_has_records boolean;
  v_paths text[];
  v_marker text := '%/s-' || p_session::text || '/%';
begin
  select * into v_row from public.league_sessions where id = p_session;
  if v_row.id is null then
    raise exception 'Session not found' using errcode = 'P0001';
  end if;
  perform public.refos_require_league_admin(v_row.event_id);
  if v_row.status = 'active' then
    raise exception 'Complete or reset this session before deleting it' using errcode = 'P0001';
  end if;
  v_counts := public.league_session_record_counts(p_session);
  select exists (select 1 from jsonb_each_text(v_counts) c where c.value::int > 0) into v_has_records;
  if (v_has_records or v_row.started_at is not null) and coalesce(p_confirm_name, '') <> v_row.name then
    return jsonb_build_object('status', 'confirm_required', 'counts', v_counts);
  end if;

  select coalesce(array_agg(p.path), '{}'::text[]) into v_paths
    from public.violations v cross join lateral unnest(coalesce(v.photo_paths, '{}'::text[])) p(path)
   where v.session_id = p_session;
  select v_paths || coalesce(array_agg(p.path), '{}'::text[]) into v_paths
    from public.teams t cross join lateral unnest(coalesce(t.photo_paths, '{}'::text[])) p(path)
   where t.event_id = v_row.event_id and p.path like v_marker;

  update public.teams t
     set photo_paths = coalesce((select array_agg(p.path order by p.ord) from unnest(t.photo_paths) with ordinality p(path, ord) where p.path not like v_marker), '{}'::text[])
   where t.event_id = v_row.event_id
     and exists (select 1 from unnest(coalesce(t.photo_paths, '{}'::text[])) p(path) where p.path like v_marker);
  delete from public.event_settings where event_id = v_row.event_id and key like '%@' || p_session::text;
  -- Session-scoped rows are removed by the foreign keys (on delete cascade).
  delete from public.league_sessions where id = p_session;
  return jsonb_build_object('status', 'deleted', 'counts', v_counts, 'paths', to_jsonb(v_paths));
end;
$$;

revoke all on function public.create_league_session(uuid, text, text, date, time, time) from public, anon;
revoke all on function public.update_league_session(uuid, text, text, date, time, time) from public, anon;
revoke all on function public.reorder_league_sessions(uuid, uuid[]) from public, anon;
revoke all on function public.set_league_session_status(uuid, text) from public, anon;
revoke all on function public.league_session_record_counts(uuid) from public, anon;
revoke all on function public.delete_league_session(uuid, text) from public, anon;
grant execute on function public.create_league_session(uuid, text, text, date, time, time) to authenticated;
grant execute on function public.update_league_session(uuid, text, text, date, time, time) to authenticated;
grant execute on function public.reorder_league_sessions(uuid, uuid[]) to authenticated;
grant execute on function public.set_league_session_status(uuid, text) to authenticated;
grant execute on function public.league_session_record_counts(uuid) to authenticated;
grant execute on function public.delete_league_session(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Realtime: devices follow session changes (new Active session, renames, attendance).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'league_sessions') then
      alter publication supabase_realtime add table public.league_sessions;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'league_session_attendance') then
      alter publication supabase_realtime add table public.league_session_attendance;
    end if;
  end if;
end $$;

commit;
