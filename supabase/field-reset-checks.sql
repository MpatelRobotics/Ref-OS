-- Ref-OS shared quadrant field reset checks
-- Run once in Supabase SQL Editor for an existing deployment.

create table if not exists public.field_reset_checks (
  event_id     uuid references public.events(id) on delete cascade,
  match_id     text not null,
  match_ref    text,
  quadrant     int not null check (quadrant between 1 and 4),
  verified_by  text,
  verified_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (event_id, match_id, quadrant)
);

alter table public.field_reset_checks enable row level security;
create index if not exists field_reset_checks_event_match_idx on public.field_reset_checks(event_id, match_id);

drop policy if exists "members read field reset checks" on public.field_reset_checks;
drop policy if exists "event roles write field reset checks" on public.field_reset_checks;

create policy "members read field reset checks" on public.field_reset_checks for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));

create policy "event roles write field reset checks" on public.field_reset_checks for all
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']))
  with check (public.has_event_role(event_id,array['ref','judge','emcee','admin']));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'field_reset_checks'
  ) then
    alter publication supabase_realtime add table public.field_reset_checks;
  end if;
end $$;
