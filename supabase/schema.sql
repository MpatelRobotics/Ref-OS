-- =====================================================================
-- VEX Violation Tracker — Supabase schema
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> paste -> Run.
-- Safe to re-run.
-- =====================================================================

-- ---------- profiles (one per signed-in user) ----------
create table if not exists public.profiles (
  id   uuid primary key references auth.users(id) on delete cascade,
  name text
);
alter table public.profiles enable row level security;

drop policy if exists "read own profile"   on public.profiles;
drop policy if exists "insert own profile"  on public.profiles;
drop policy if exists "update own profile"  on public.profiles;
create policy "read own profile"  on public.profiles for select using (auth.uid() = id);
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id);

-- ---------- events ----------
create table if not exists public.events (
  id             uuid primary key default gen_random_uuid(),
  name           text,
  quals          int  default 0,
  practice       int  default 0,
  bracket        int  default 0,
  finals_best_of int  default 1,
  join_code      text unique not null,
  created_by     uuid default auth.uid(),
  created_at     timestamptz default now()
);
alter table public.events enable row level security;

-- ---------- event membership (who can see/edit an event) ----------
create table if not exists public.event_members (
  event_id uuid references public.events(id) on delete cascade,
  user_id  uuid references auth.users(id)    on delete cascade,
  name     text,
  role     text not null default 'ref',
  primary key (event_id, user_id)
);
alter table public.event_members add column if not exists role text not null default 'ref';
alter table public.event_members enable row level security;

-- membership check as SECURITY DEFINER so policies don't recurse
create or replace function public.is_member(p_event uuid)
returns boolean language sql security definer stable
set search_path = public, extensions as $$
  select exists (
    select 1 from public.event_members m
    where m.event_id = p_event and m.user_id = auth.uid()
  );
$$;

drop policy if exists "members read events"  on public.events;
drop policy if exists "create events"        on public.events;
drop policy if exists "members update events" on public.events;
drop policy if exists "open read events"     on public.events;
drop policy if exists "open update events"   on public.events;

drop policy if exists "read memberships" on public.event_members;
drop policy if exists "join self"        on public.event_members;
drop policy if exists "leave self"       on public.event_members;

-- ---------- event settings (typed shared event configuration) ----------
create table if not exists public.event_settings (
  event_id   uuid references public.events(id) on delete cascade,
  key        text not null,
  value      jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz default now(),
  primary key (event_id, key)
);
alter table public.event_settings enable row level security;
drop policy if exists "open rw event settings" on public.event_settings;
create index if not exists event_settings_event_idx on public.event_settings(event_id);

-- ---------- server enforced event access ----------
create extension if not exists pgcrypto;

create table if not exists public.event_access_credentials (
  event_id        uuid references public.events(id) on delete cascade,
  credential_name text not null,
  role            text not null check (role in ('ref','judge','emcee','admin')),
  credential_hash text not null,
  enabled         boolean not null default true,
  updated_at      timestamptz default now(),
  primary key (event_id, credential_name)
);
alter table public.event_access_credentials enable row level security;


create table if not exists public.event_access_attempts (
  event_id       uuid references public.events(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete cascade,
  failed_count   int not null default 0,
  window_started timestamptz not null default now(),
  locked_until   timestamptz,
  primary key (event_id,user_id)
);
alter table public.event_access_attempts enable row level security;

create or replace function public.has_event_role(p_event uuid, p_roles text[])
returns boolean language sql security definer stable
set search_path = public, extensions as $$
  select exists (
    select 1 from public.event_members m
    where m.event_id = p_event
      and m.user_id = auth.uid()
      and m.role = any(p_roles)
  );
$$;

create or replace function public.claim_event_access(p_event uuid, p_credential text)
returns table(role text, is_admin boolean)
language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_role text;
  v_hash text;
  v_attempt public.event_access_attempts%rowtype;
  v_failed int;
begin
  if auth.uid() is null then
    raise exception 'Authentication session required';
  end if;

  select * into v_attempt
  from public.event_access_attempts
  where event_id=p_event and user_id=auth.uid();

  if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    raise exception 'Too many login attempts. Try again in a few minutes.';
  end if;

  v_hash := encode(digest(coalesce(p_credential,''), 'sha256'), 'hex');

  select c.role into v_role
  from public.event_access_credentials c
  where c.event_id = p_event
    and c.enabled = true
    and c.credential_hash = v_hash
  order by case when c.role = 'admin' then 0 else 1 end
  limit 1;

  if v_role is null then
    if v_attempt.user_id is null or v_attempt.window_started < now() - interval '5 minutes' then
      v_failed := 1;
      insert into public.event_access_attempts(event_id,user_id,failed_count,window_started,locked_until)
      values(p_event,auth.uid(),1,now(),null)
      on conflict(event_id,user_id)
      do update set failed_count=1,window_started=now(),locked_until=null;
    else
      v_failed := v_attempt.failed_count + 1;
      update public.event_access_attempts
      set failed_count=v_failed,
          locked_until=case when v_failed >= 8 then now() + interval '5 minutes' else null end
      where event_id=p_event and user_id=auth.uid();
    end if;

    if v_failed >= 8 then
      raise exception 'Too many login attempts. Try again in a few minutes.';
    end if;
    raise exception 'Invalid event credential';
  end if;

  delete from public.event_access_attempts
  where event_id=p_event and user_id=auth.uid();

  insert into public.event_members(event_id, user_id, role)
  values (p_event, auth.uid(), v_role)
  on conflict (event_id, user_id)
  do update set role = excluded.role;

  return query select v_role, (v_role = 'admin');
end;
$$;

create or replace function public.set_event_access_credential(
  p_event uuid,
  p_name text,
  p_role text,
  p_hash text,
  p_enabled boolean default true
)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not public.has_event_role(p_event, array['admin']) then
    raise exception 'Admin role required';
  end if;
  if p_role not in ('ref','judge','emcee','admin') then
    raise exception 'Invalid role';
  end if;
  insert into public.event_access_credentials(event_id, credential_name, role, credential_hash, enabled, updated_at)
  values (p_event, p_name, p_role, p_hash, p_enabled, now())
  on conflict (event_id, credential_name)
  do update set role = excluded.role,
                credential_hash = excluded.credential_hash,
                enabled = excluded.enabled,
                updated_at = now();
end;
$$;

create or replace function public.disable_event_access_credential(p_event uuid, p_name text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not public.has_event_role(p_event, array['admin']) then
    raise exception 'Admin role required';
  end if;
  update public.event_access_credentials
  set enabled = false, updated_at = now()
  where event_id = p_event and credential_name = p_name;
end;
$$;



create or replace function public.set_my_event_member_name(p_event uuid, p_name text)
returns void language plpgsql security definer set search_path=public, extensions as $$
begin
  if auth.uid() is null then raise exception 'Authentication session required'; end if;
  update public.event_members
  set name=trim(coalesce(p_name,''))
  where event_id=p_event and user_id=auth.uid();
end;
$$;

create or replace function public.downgrade_my_event_role(p_event uuid, p_role text)
returns void language plpgsql security definer set search_path=public, extensions as $$
begin
  if p_role not in ('ref','judge','emcee') then raise exception 'Invalid downgrade role'; end if;
  if not public.has_event_role(p_event,array['admin']) then raise exception 'Admin role required'; end if;
  update public.event_members
  set role=p_role
  where event_id=p_event and user_id=auth.uid();
end;
$$;


revoke all on function public.claim_event_access(uuid,text) from anon;
grant execute on function public.claim_event_access(uuid,text) to authenticated;
revoke all on function public.set_event_access_credential(uuid,text,text,text,boolean) from anon;
grant execute on function public.set_event_access_credential(uuid,text,text,text,boolean) to authenticated;
revoke all on function public.disable_event_access_credential(uuid,text) from anon;
grant execute on function public.disable_event_access_credential(uuid,text) to authenticated;
revoke all on function public.downgrade_my_event_role(uuid,text) from anon;
grant execute on function public.downgrade_my_event_role(uuid,text) to authenticated;
revoke all on function public.set_my_event_member_name(uuid,text) from anon;
grant execute on function public.set_my_event_member_name(uuid,text) to authenticated;


-- Disable legacy event join/create RPCs that bypass Ref OS 1.2 credential roles.
revoke execute on function public.join_event_by_code(text) from anon, authenticated;
revoke execute on function public.create_event(text,int,int,int,int) from anon, authenticated;

-- The permanent keypad Admin credential requested for Highlander Summit.
insert into public.event_access_credentials(event_id, credential_name, role, credential_hash, enabled)
values (
  '11111111-1111-4111-8111-111111111111',
  'admin_keypad',
  'admin',
  encode(digest('1A23', 'sha256'), 'hex'),
  true
)
on conflict (event_id, credential_name)
do update set role = excluded.role, credential_hash = excluded.credential_hash, enabled = true;

-- ---------- teams (per event) ----------
create table if not exists public.teams (
  event_id   uuid references public.events(id) on delete cascade,
  number     text not null,
  name       text,
  created_at timestamptz default now(),
  primary key (event_id, number)
);
alter table public.teams enable row level security;
alter table public.teams add column if not exists photo_paths text[] default '{}';
alter table public.teams add column if not exists rank int;
drop policy if exists "members rw teams" on public.teams;
drop policy if exists "open rw teams" on public.teams;

-- ---------- violations (per event) ----------
create table if not exists public.violations (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid references public.events(id) on delete cascade,
  team        text not null,
  type        text not null,          -- 'minor' | 'major' | 'inspection'
  code        text,                   -- rule code, e.g. R7
  rule_desc   text,
  notes       text,
  match_info  jsonb,                  -- { phase, num }
  logged_by   text,                   -- ref name (denormalized for display)
  photo_paths text[] default '{}',    -- storage object paths in 'robot-photos'
  created_at  timestamptz default now()
);
alter table public.violations enable row level security;
drop policy if exists "members rw violations" on public.violations;
drop policy if exists "open rw violations" on public.violations;

create index if not exists violations_event_idx on public.violations(event_id);
create index if not exists teams_event_idx on public.teams(event_id);

-- ---------- RPCs: create an event, or join one by code (atomic + safe) ----------
create or replace function public.create_event(
  p_name text, p_quals int, p_practice int, p_bracket int, p_finals int
) returns public.events language plpgsql security definer
set search_path = public, extensions as $$
declare ev public.events; code text;
begin
  code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.events(name, quals, practice, bracket, finals_best_of, join_code, created_by)
    values (p_name, p_quals, p_practice, p_bracket, p_finals, code, auth.uid())
    returning * into ev;
  insert into public.event_members(event_id, user_id, name)
    values (ev.id, auth.uid(), (select name from public.profiles where id = auth.uid()));
  return ev;
end; $$;

create or replace function public.join_event_by_code(p_code text)
returns public.events language plpgsql security definer
set search_path = public, extensions as $$
declare ev public.events;
begin
  select * into ev from public.events where join_code = upper(p_code);
  if not found then raise exception 'No event with that code'; end if;
  insert into public.event_members(event_id, user_id, name)
    values (ev.id, auth.uid(), (select name from public.profiles where id = auth.uid()))
    on conflict (event_id, user_id) do nothing;
  return ev;
end; $$;

-- ---------- realtime (idempotent: skip tables already in the publication) ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'violations')
    then alter publication supabase_realtime add table public.violations; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'teams')
    then alter publication supabase_realtime add table public.teams; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events')
    then alter publication supabase_realtime add table public.events; end if;
end $$;

-- ---------- private storage bucket for robot photos (event membership enforced) ----------
insert into storage.buckets (id, name, public)
  values ('robot-photos', 'robot-photos', false)
  on conflict (id) do update set public = false;

drop policy if exists "members read photos"   on storage.objects;
drop policy if exists "members upload photos" on storage.objects;
drop policy if exists "members delete photos" on storage.objects;
drop policy if exists "open read photos"   on storage.objects;
drop policy if exists "open upload photos" on storage.objects;
drop policy if exists "open delete photos" on storage.objects;

-- ---------- match schedule (qualification) ----------
create table if not exists public.matches (
  event_id uuid references public.events(id) on delete cascade,
  num      int not null,               -- match number within its phase
  phase    text not null default 'qual',-- 'qual' | 'r16' | 'qf' | 'sf' | 'final' | 'practice'
  label    text,                        -- optional display label (e.g. 'QF 1-1')
  winner   text,                         -- 'red' | 'blue' (elimination result, drives bracket advance)
  red_score  int,
  blue_score int,
  red      text[] not null default '{}',
  blue     text[] not null default '{}',
  field    text,
  scheduled timestamptz,
  primary key (event_id, phase, num)
);
-- for tables created before elimination support: add columns + widen the primary key
alter table public.matches add column if not exists phase text not null default 'qual';
alter table public.matches add column if not exists label text;
alter table public.matches add column if not exists winner text;
alter table public.matches add column if not exists red_score int;
alter table public.matches add column if not exists blue_score int;
alter table public.matches drop constraint if exists matches_pkey;
alter table public.matches add primary key (event_id, phase, num);
alter table public.matches enable row level security;
drop policy if exists "open rw matches" on public.matches;
create index if not exists matches_event_idx on public.matches(event_id);

-- ---------- rulebook (for the Rule-cited autocomplete) ----------
create table if not exists public.rules (
  event_id    uuid references public.events(id) on delete cascade,
  code        text not null,
  description text,
  category    text,
  ord         int,
  primary key (event_id, code)
);
alter table public.rules enable row level security;
drop policy if exists "open rw rules" on public.rules;

-- ---------- award nominations (Judging tab) ----------
create table if not exists public.nominations (
  id          uuid primary key,
  event_id    uuid references public.events(id) on delete cascade,
  award       text not null,          -- 'sportsmanship' | 'energy'
  team        text not null,
  match_info  jsonb,
  reason      text,
  criteria    text[],                 -- observed-criteria the ref checked
  where_when  text,                   -- where/when observed
  nominated_by text,
  nominated_role text,
  created_at  timestamptz default now()
);
alter table public.nominations add column if not exists criteria text[];
alter table public.nominations add column if not exists where_when text;
alter table public.nominations add column if not exists nominated_role text;
alter table public.nominations enable row level security;
drop policy if exists "open rw nominations" on public.nominations;
create index if not exists nominations_event_idx on public.nominations(event_id);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'nominations')
    then alter publication supabase_realtime add table public.nominations; end if;
end $$;

-- ---------- award shortlist / finalists (Judging tab) ----------
create table if not exists public.shortlist (
  event_id uuid references public.events(id) on delete cascade,
  award    text not null,
  team     text not null,
  primary key (event_id, award, team)
);
alter table public.shortlist enable row level security;
drop policy if exists "open rw shortlist" on public.shortlist;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shortlist')
    then alter publication supabase_realtime add table public.shortlist; end if;
end $$;

-- ---------- team watchlist notes (multiple refs per team) ----------
create table if not exists public.watch_notes (
  id         uuid primary key,
  event_id   uuid references public.events(id) on delete cascade,
  team       text not null,
  ref_name   text,
  note       text,
  created_at timestamptz default now()
);
alter table public.watch_notes enable row level security;
drop policy if exists "open rw watch_notes" on public.watch_notes;
create index if not exists watch_notes_event_idx on public.watch_notes(event_id);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'watch_notes')
    then alter publication supabase_realtime add table public.watch_notes; end if;
end $$;


-- ---------- field log (timeouts, field faults, match replays) ----------
create table if not exists public.field_log (
  id         uuid primary key,
  event_id   uuid references public.events(id) on delete cascade,
  kind       text not null,            -- 'timeout' | 'field_fault' | 'replay' | 'other'
  field      text,
  match_ref  text,
  match_id   text,                     -- composite match id this entry is tied to (e.g. '54' or 'qf-1')
  alliance   text,                     -- 'red' | 'blue' (for timeouts)
  team       text,                     -- optional team a timeout is tied to
  teams      text[],                   -- alliance roster at time of a timeout (for one-per-alliance enforcement)
  note       text,
  logged_by  text,
  created_at timestamptz default now()
);
alter table public.field_log add column if not exists match_id text;
alter table public.field_log add column if not exists alliance text;
alter table public.field_log add column if not exists team text;
alter table public.field_log add column if not exists teams text[];
alter table public.field_log enable row level security;
drop policy if exists "open rw field_log" on public.field_log;
create index if not exists field_log_event_idx on public.field_log(event_id);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'field_log')
    then alter publication supabase_realtime add table public.field_log; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches')
    then alter publication supabase_realtime add table public.matches; end if;
end $$;


-- ---------- shared field reset status ----------
create table if not exists public.field_reset_status (
  event_id     uuid references public.events(id) on delete cascade,
  match_id     text not null,
  match_ref    text,
  state        jsonb not null default '{}'::jsonb,
  verified_by  text,
  verified_at  timestamptz,
  updated_by   text,
  updated_at   timestamptz not null default now(),
  primary key (event_id, match_id)
);
alter table public.field_reset_status enable row level security;
create index if not exists field_reset_status_event_idx on public.field_reset_status(event_id);
drop policy if exists "members read field reset status" on public.field_reset_status;
drop policy if exists "event roles write field reset status" on public.field_reset_status;
create policy "members read field reset status" on public.field_reset_status for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "event roles write field reset status" on public.field_reset_status for all
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']))
  with check (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'field_reset_status')
    then alter publication supabase_realtime add table public.field_reset_status; end if;
end $$;

-- ---------- elimination alliances (admin-entered during alliance selection) ----------
create table if not exists public.alliances (
  event_id   uuid references public.events(id) on delete cascade,
  seed       int not null,
  teams      text[] not null default '{}',
  updated_at timestamptz default now(),
  primary key (event_id, seed)
);
alter table public.alliances enable row level security;
drop policy if exists "open rw alliances" on public.alliances;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alliances')
    then alter publication supabase_realtime add table public.alliances; end if;
end $$;


-- ===== Ref OS 1.2 server-enforced hardening =====
-- Ref OS 1.2 server enforced access migration
-- REQUIRED: enable Anonymous Sign-Ins in Supabase Auth before deploying this build.

create extension if not exists pgcrypto;

alter table public.event_members add column if not exists role text not null default 'ref';

create table if not exists public.event_access_credentials (
  event_id        uuid references public.events(id) on delete cascade,
  credential_name text not null,
  role            text not null check (role in ('ref','judge','emcee','admin')),
  credential_hash text not null,
  enabled         boolean not null default true,
  updated_at      timestamptz default now(),
  primary key (event_id, credential_name)
);
alter table public.event_access_credentials enable row level security;

create or replace function public.has_event_role(p_event uuid, p_roles text[])
returns boolean language sql security definer stable
set search_path = public, extensions as $$
  select exists (
    select 1 from public.event_members m
    where m.event_id = p_event and m.user_id = auth.uid() and m.role = any(p_roles)
  );
$$;

create or replace function public.claim_event_access(p_event uuid, p_credential text)
returns table(role text, is_admin boolean)
language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_role text;
  v_hash text;
  v_attempt public.event_access_attempts%rowtype;
  v_failed int;
begin
  if auth.uid() is null then
    raise exception 'Authentication session required';
  end if;

  select * into v_attempt
  from public.event_access_attempts
  where event_id=p_event and user_id=auth.uid();

  if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    raise exception 'Too many login attempts. Try again in a few minutes.';
  end if;

  v_hash := encode(digest(coalesce(p_credential,''), 'sha256'), 'hex');

  select c.role into v_role
  from public.event_access_credentials c
  where c.event_id = p_event
    and c.enabled = true
    and c.credential_hash = v_hash
  order by case when c.role = 'admin' then 0 else 1 end
  limit 1;

  if v_role is null then
    if v_attempt.user_id is null or v_attempt.window_started < now() - interval '5 minutes' then
      v_failed := 1;
      insert into public.event_access_attempts(event_id,user_id,failed_count,window_started,locked_until)
      values(p_event,auth.uid(),1,now(),null)
      on conflict(event_id,user_id)
      do update set failed_count=1,window_started=now(),locked_until=null;
    else
      v_failed := v_attempt.failed_count + 1;
      update public.event_access_attempts
      set failed_count=v_failed,
          locked_until=case when v_failed >= 8 then now() + interval '5 minutes' else null end
      where event_id=p_event and user_id=auth.uid();
    end if;

    if v_failed >= 8 then
      raise exception 'Too many login attempts. Try again in a few minutes.';
    end if;
    raise exception 'Invalid event credential';
  end if;

  delete from public.event_access_attempts
  where event_id=p_event and user_id=auth.uid();

  insert into public.event_members(event_id, user_id, role)
  values (p_event, auth.uid(), v_role)
  on conflict (event_id, user_id)
  do update set role = excluded.role;

  return query select v_role, (v_role = 'admin');
end;
$$;

create or replace function public.set_event_access_credential(
  p_event uuid, p_name text, p_role text, p_hash text, p_enabled boolean default true
)
returns void language plpgsql security definer set search_path=public, extensions as $$
begin
  if not public.has_event_role(p_event,array['admin']) then raise exception 'Admin role required'; end if;
  if p_role not in ('ref','judge','emcee','admin') then raise exception 'Invalid role'; end if;
  insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled,updated_at)
  values(p_event,p_name,p_role,p_hash,p_enabled,now())
  on conflict(event_id,credential_name)
  do update set role=excluded.role,credential_hash=excluded.credential_hash,enabled=excluded.enabled,updated_at=now();
end;
$$;

create or replace function public.disable_event_access_credential(p_event uuid,p_name text)
returns void language plpgsql security definer set search_path=public, extensions as $$
begin
  if not public.has_event_role(p_event,array['admin']) then raise exception 'Admin role required'; end if;
  update public.event_access_credentials set enabled=false,updated_at=now()
  where event_id=p_event and credential_name=p_name;
end;
$$;

insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
select id,'admin_keypad','admin',encode(digest('1A23','sha256'),'hex'),true
from public.events
where id='11111111-1111-4111-8111-111111111111'
on conflict(event_id,credential_name)
do update set role=excluded.role,credential_hash=excluded.credential_hash,enabled=true;

create table if not exists public.ref_roster (
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  last_seen timestamptz not null default now(),
  role text,
  primary key (event_id, name)
);
alter table public.ref_roster add column if not exists role text;
alter table public.ref_roster enable row level security;

drop policy if exists "ref roster read" on public.ref_roster;
drop policy if exists "ref roster insert" on public.ref_roster;
drop policy if exists "ref roster update" on public.ref_roster;
drop policy if exists "ref roster delete" on public.ref_roster;
create policy "ref roster read" on public.ref_roster for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "ref roster insert" on public.ref_roster for insert
  with check (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "ref roster update" on public.ref_roster for update
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']))
  with check (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "ref roster delete" on public.ref_roster for delete
  using (public.has_event_role(event_id,array['admin']));

-- Carry forward any already generated volunteer code hashes from Ref OS 1.1.
insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
select event_id,'ref_code','ref',value #>> '{codes,ref,hash}',
       coalesce((value #>> '{codes,ref,enabled}')::boolean,false)
from public.event_settings
where key='role_access_codes' and value #>> '{codes,ref,hash}' is not null
on conflict(event_id,credential_name)
do update set credential_hash=excluded.credential_hash,enabled=excluded.enabled,updated_at=now();

insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
select event_id,'judge_code','judge',value #>> '{codes,judge,hash}',
       coalesce((value #>> '{codes,judge,enabled}')::boolean,false)
from public.event_settings
where key='role_access_codes' and value #>> '{codes,judge,hash}' is not null
on conflict(event_id,credential_name)
do update set credential_hash=excluded.credential_hash,enabled=excluded.enabled,updated_at=now();

insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
select event_id,'emcee_code','emcee',value #>> '{codes,emcee,hash}',
       coalesce((value #>> '{codes,emcee,enabled}')::boolean,false)
from public.event_settings
where key='role_access_codes' and value #>> '{codes,emcee,hash}' is not null
on conflict(event_id,credential_name)
do update set credential_hash=excluded.credential_hash,enabled=excluded.enabled,updated_at=now();

-- Replace permissive app data policies with membership and role based policies.
drop policy if exists "open read events" on public.events;
drop policy if exists "open update events" on public.events;
drop policy if exists "members read events" on public.events;
drop policy if exists "members update events" on public.events;
create policy "members read events" on public.events for select
  using (public.has_event_role(id,array['ref','judge','emcee','admin']));
drop policy if exists "admins update events" on public.events;
create policy "admins update events" on public.events for update
  using (public.has_event_role(id,array['admin']))
  with check (public.has_event_role(id,array['admin']));

drop policy if exists "join self" on public.event_members;
drop policy if exists "read memberships" on public.event_members;
drop policy if exists "leave self" on public.event_members;
drop policy if exists "members read memberships" on public.event_members;
drop policy if exists "members leave self" on public.event_members;
create policy "members read memberships" on public.event_members for select
  using (user_id=auth.uid() or public.has_event_role(event_id,array['admin']));
create policy "members leave self" on public.event_members for delete
  using (user_id=auth.uid());

drop policy if exists "open rw event settings" on public.event_settings;
drop policy if exists "members read event settings" on public.event_settings;
drop policy if exists "admins write event settings" on public.event_settings;
create policy "members read event settings" on public.event_settings for select
  using (
    public.has_event_role(event_id,array['admin'])
    or (
      key <> 'role_access_codes'
      and public.has_event_role(event_id,array['ref','judge','emcee'])
    )
  );
create policy "admins write event settings" on public.event_settings for all
  using (public.has_event_role(event_id,array['admin']))
  with check (public.has_event_role(event_id,array['admin']));

drop policy if exists "open rw teams" on public.teams;
drop policy if exists "members read teams" on public.teams;
drop policy if exists "refs write teams" on public.teams;
create policy "members read teams" on public.teams for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "refs write teams" on public.teams for all
  using (public.has_event_role(event_id,array['ref','admin']))
  with check (public.has_event_role(event_id,array['ref','admin']));

drop policy if exists "open rw violations" on public.violations;
drop policy if exists "members read violations" on public.violations;
drop policy if exists "refs write violations" on public.violations;
create policy "members read violations" on public.violations for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "refs write violations" on public.violations for all
  using (public.has_event_role(event_id,array['ref','admin']))
  with check (public.has_event_role(event_id,array['ref','admin']));

drop policy if exists "open rw matches" on public.matches;
drop policy if exists "members read matches" on public.matches;
drop policy if exists "field roles write matches" on public.matches;
create policy "members read matches" on public.matches for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "field roles write matches" on public.matches for all
  using (public.has_event_role(event_id,array['ref','emcee','admin']))
  with check (public.has_event_role(event_id,array['ref','emcee','admin']));

drop policy if exists "open rw rules" on public.rules;
drop policy if exists "members read rules" on public.rules;
drop policy if exists "admins write rules" on public.rules;
create policy "members read rules" on public.rules for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "admins write rules" on public.rules for all
  using (public.has_event_role(event_id,array['admin']))
  with check (public.has_event_role(event_id,array['admin']));

drop policy if exists "open rw nominations" on public.nominations;
drop policy if exists "members read nominations" on public.nominations;
drop policy if exists "ref judge write nominations" on public.nominations;
create policy "members read nominations" on public.nominations for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "ref judge write nominations" on public.nominations for all
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']))
  with check (public.has_event_role(event_id,array['ref','judge','emcee','admin']));

drop policy if exists "open rw shortlist" on public.shortlist;
drop policy if exists "members read shortlist" on public.shortlist;
drop policy if exists "judge write shortlist" on public.shortlist;
create policy "members read shortlist" on public.shortlist for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "judge write shortlist" on public.shortlist for all
  using (public.has_event_role(event_id,array['judge','admin']))
  with check (public.has_event_role(event_id,array['judge','admin']));

drop policy if exists "open rw watch_notes" on public.watch_notes;
drop policy if exists "members read watch notes" on public.watch_notes;
drop policy if exists "refs write watch notes" on public.watch_notes;
create policy "members read watch notes" on public.watch_notes for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "refs write watch notes" on public.watch_notes for all
  using (public.has_event_role(event_id,array['ref','admin']))
  with check (public.has_event_role(event_id,array['ref','admin']));

drop policy if exists "open rw field_log" on public.field_log;
drop policy if exists "members read field log" on public.field_log;
drop policy if exists "event roles write field log" on public.field_log;
create policy "members read field log" on public.field_log for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "event roles write field log" on public.field_log for all
  using (public.has_event_role(event_id,array['ref','emcee','admin']))
  with check (public.has_event_role(event_id,array['ref','emcee','admin']));

drop policy if exists "open rw alliances" on public.alliances;
drop policy if exists "members read alliances" on public.alliances;
drop policy if exists "admins write alliances" on public.alliances;
create policy "members read alliances" on public.alliances for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "admins write alliances" on public.alliances for all
  using (public.has_event_role(event_id,array['admin']))
  with check (public.has_event_role(event_id,array['admin']));

-- Robot photos stay publicly readable because the current UI uses public URLs.
-- Upload and delete are now role protected by the event id at the start of the storage path.
drop policy if exists "open upload photos" on storage.objects;
drop policy if exists "open delete photos" on storage.objects;
drop policy if exists "members upload photos" on storage.objects;
drop policy if exists "members delete photos" on storage.objects;
create policy "members upload photos" on storage.objects for insert
with check (
  bucket_id='robot-photos'
  and public.has_event_role((storage.foldername(name))[1]::uuid,array['ref','admin'])
);
create policy "members delete photos" on storage.objects for delete
using (
  bucket_id='robot-photos'
  and public.has_event_role((storage.foldername(name))[1]::uuid,array['ref','admin'])
);

-- Credentials are never directly readable by the browser.
drop policy if exists "credentials direct access" on public.event_access_credentials;


create or replace function public.downgrade_my_event_role(p_event uuid, p_role text)
returns void language plpgsql security definer set search_path=public, extensions as $$
begin
  if p_role not in ('ref','judge','emcee') then raise exception 'Invalid downgrade role'; end if;
  if not public.has_event_role(p_event,array['admin']) then raise exception 'Admin role required'; end if;
  update public.event_members
  set role=p_role
  where event_id=p_event and user_id=auth.uid();
end;
$$;



-- Ref OS 1.2 final storage enforcement
update storage.buckets set public=false where id='robot-photos';
drop policy if exists "open read photos" on storage.objects;
drop policy if exists "members read photos" on storage.objects;
create policy "members read photos" on storage.objects for select
using (
  bucket_id='robot-photos'
  and public.has_event_role((storage.foldername(name))[1]::uuid,array['ref','judge','emcee','admin'])
);


-- Shared settings must participate in Realtime so countdown/contact/code changes reach other devices.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='event_settings'
  ) then
    alter publication supabase_realtime add table public.event_settings;
  end if;
end $$;


-- Admin volunteer role management
create or replace function public.list_event_members_for_admin(p_event uuid)
returns table(user_id uuid, name text, role text)
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
    select m.user_id, m.name, m.role
    from public.event_members m
    where m.event_id = p_event
    order by lower(coalesce(m.name, '')), m.user_id;
end;
$$;

revoke all on function public.list_event_members_for_admin(uuid) from anon;
grant execute on function public.list_event_members_for_admin(uuid) to authenticated;

create or replace function public.set_event_member_admin(
  p_event uuid,
  p_user uuid,
  p_make_admin boolean
)
returns void
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

  if p_user = auth.uid() and not p_make_admin then
    raise exception 'Use Lock admin access to remove your own Admin role';
  end if;

  if not exists (
    select 1 from public.event_members
    where event_id = p_event and user_id = p_user
  ) then
    raise exception 'Volunteer is not signed in to this event';
  end if;

  update public.event_members
  set role = case when p_make_admin then 'admin' else 'ref' end
  where event_id = p_event and user_id = p_user;
end;
$$;

revoke all on function public.set_event_member_admin(uuid,uuid,boolean) from anon;
grant execute on function public.set_event_member_admin(uuid,uuid,boolean) to authenticated;
