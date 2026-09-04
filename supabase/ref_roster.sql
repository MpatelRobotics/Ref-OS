-- Ref OS volunteer roster with server enforced event membership.
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
