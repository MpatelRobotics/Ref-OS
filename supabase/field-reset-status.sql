-- Ref OS shared Field Reset status migration
-- Run once in the Supabase SQL Editor before deploying this build.

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
