-- Ref OS shared AWP status migration
-- Run once in the Supabase SQL Editor before deploying this build.

create table if not exists public.awp_status (
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

alter table public.awp_status enable row level security;
create index if not exists awp_status_event_idx on public.awp_status(event_id);

drop policy if exists "members read awp status" on public.awp_status;
drop policy if exists "event roles write awp status" on public.awp_status;
create policy "members read awp status" on public.awp_status for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "event roles write awp status" on public.awp_status for all
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']))
  with check (public.has_event_role(event_id,array['ref','judge','emcee','admin']));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'awp_status')
    then alter publication supabase_realtime add table public.awp_status; end if;
end $$;
