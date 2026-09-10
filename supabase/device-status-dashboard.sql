-- Ref OS Device Sync Dashboard
-- Run once in the Supabase SQL Editor.

create table if not exists public.device_status (
  event_id uuid not null references public.events(id) on delete cascade,
  device_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Ref',
  role text not null default 'ref',
  device_label text not null default 'Unknown device',
  browser text not null default '',
  platform text not null default '',
  viewport text not null default '',
  display_mode text not null default 'browser',
  app_version text not null default '',
  cloud_reachable boolean,
  syncing boolean not null default false,
  queued_writes integer not null default 0,
  failed_writes integer not null default 0,
  last_synced_at timestamptz,
  last_seen timestamptz not null default now(),
  primary key (event_id, device_id)
);

alter table public.device_status enable row level security;

drop policy if exists "members write own device status" on public.device_status;
create policy "members write own device status" on public.device_status
for insert with check (
  user_id = auth.uid()
  and public.has_event_role(event_id, array['ref','judge','emcee','admin'])
);

drop policy if exists "members update own device status" on public.device_status;
create policy "members update own device status" on public.device_status
for update using (
  user_id = auth.uid()
  and public.has_event_role(event_id, array['ref','judge','emcee','admin'])
) with check (
  user_id = auth.uid()
  and public.has_event_role(event_id, array['ref','judge','emcee','admin'])
);

drop policy if exists "admins read device status" on public.device_status;
create policy "admins read device status" on public.device_status
for select using (public.has_event_role(event_id, array['admin']));

create index if not exists device_status_event_last_seen_idx
  on public.device_status(event_id, last_seen desc);
