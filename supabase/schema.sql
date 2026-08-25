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
  primary key (event_id, user_id)
);
alter table public.event_members enable row level security;

-- membership check as SECURITY DEFINER so policies don't recurse
create or replace function public.is_member(p_event uuid)
returns boolean language sql security definer stable
set search_path = public as $$
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
create policy "open read events"   on public.events for select using (true);
create policy "open update events" on public.events for update using (true) with check (true);

drop policy if exists "read memberships" on public.event_members;
drop policy if exists "join self"        on public.event_members;
drop policy if exists "leave self"       on public.event_members;
create policy "read memberships" on public.event_members for select using (user_id = auth.uid() or public.is_member(event_id));
create policy "join self"        on public.event_members for insert with check (user_id = auth.uid());
create policy "leave self"       on public.event_members for delete using (user_id = auth.uid());

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
drop policy if exists "members rw teams" on public.teams;
drop policy if exists "open rw teams" on public.teams;
create policy "open rw teams" on public.teams for all using (true) with check (true);

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
create policy "open rw violations" on public.violations for all using (true) with check (true);

create index if not exists violations_event_idx on public.violations(event_id);
create index if not exists teams_event_idx on public.teams(event_id);

-- ---------- RPCs: create an event, or join one by code (atomic + safe) ----------
create or replace function public.create_event(
  p_name text, p_quals int, p_practice int, p_bracket int, p_finals int
) returns public.events language plpgsql security definer
set search_path = public as $$
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
set search_path = public as $$
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

-- ---------- storage bucket for robot photos (public read; app password gates upload UI) ----------
insert into storage.buckets (id, name, public)
  values ('robot-photos', 'robot-photos', true)
  on conflict (id) do update set public = true;

drop policy if exists "members read photos"   on storage.objects;
drop policy if exists "members upload photos" on storage.objects;
drop policy if exists "members delete photos" on storage.objects;
drop policy if exists "open read photos"   on storage.objects;
drop policy if exists "open upload photos" on storage.objects;
drop policy if exists "open delete photos" on storage.objects;
create policy "open read photos"   on storage.objects for select using (bucket_id = 'robot-photos');
create policy "open upload photos" on storage.objects for insert with check (bucket_id = 'robot-photos');
create policy "open delete photos" on storage.objects for delete using (bucket_id = 'robot-photos');

-- ---------- match schedule (qualification) ----------
create table if not exists public.matches (
  event_id uuid references public.events(id) on delete cascade,
  num      int not null,               -- match number within its phase
  phase    text not null default 'qual',-- 'qual' | 'r16' | 'qf' | 'sf' | 'final' | 'practice'
  label    text,                        -- optional display label (e.g. 'QF 1-1')
  red      text[] not null default '{}',
  blue     text[] not null default '{}',
  field    text,
  scheduled timestamptz,
  primary key (event_id, phase, num)
);
-- for tables created before elimination support: add columns + widen the primary key
alter table public.matches add column if not exists phase text not null default 'qual';
alter table public.matches add column if not exists label text;
alter table public.matches drop constraint if exists matches_pkey;
alter table public.matches add primary key (event_id, phase, num);
alter table public.matches enable row level security;
drop policy if exists "open rw matches" on public.matches;
create policy "open rw matches" on public.matches for all using (true) with check (true);
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
create policy "open rw rules" on public.rules for all using (true) with check (true);

-- ---------- award nominations (Judging tab) ----------
create table if not exists public.nominations (
  id          uuid primary key,
  event_id    uuid references public.events(id) on delete cascade,
  award       text not null,          -- 'sportsmanship' | 'energy'
  team        text not null,
  match_info  jsonb,
  reason      text,
  nominated_by text,
  created_at  timestamptz default now()
);
alter table public.nominations enable row level security;
drop policy if exists "open rw nominations" on public.nominations;
create policy "open rw nominations" on public.nominations for all using (true) with check (true);
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
create policy "open rw shortlist" on public.shortlist for all using (true) with check (true);
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
create policy "open rw watch_notes" on public.watch_notes for all using (true) with check (true);
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
create policy "open rw field_log" on public.field_log for all using (true) with check (true);
create index if not exists field_log_event_idx on public.field_log(event_id);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'field_log')
    then alter publication supabase_realtime add table public.field_log; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches')
    then alter publication supabase_realtime add table public.matches; end if;
end $$;
