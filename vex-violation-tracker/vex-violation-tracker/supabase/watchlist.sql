-- Ref-OS Team Watchlist
-- Run once in the Supabase SQL Editor before deploying this build.

alter table public.teams
  add column if not exists watchlisted boolean not null default false,
  add column if not exists watch_note text;

create index if not exists teams_event_watchlisted_idx
  on public.teams (event_id, watchlisted);
