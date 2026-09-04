-- Ref OS 1.1 hardening migration
-- Run once in Supabase SQL Editor before using typed shared settings.

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
create policy "open rw event settings"
  on public.event_settings for all
  using (true)
  with check (true);

create index if not exists event_settings_event_idx
  on public.event_settings(event_id);
