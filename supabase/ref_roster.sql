-- Run once in the Supabase SQL Editor to enable the online/offline ref roster.
create table if not exists public.ref_roster (
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  last_seen timestamptz not null default now(),
  role text,
  primary key (event_id, name)
);

-- For databases created before the role column existed:
alter table public.ref_roster add column if not exists role text;

alter table public.ref_roster enable row level security;

drop policy if exists "ref roster read" on public.ref_roster;
drop policy if exists "ref roster insert" on public.ref_roster;
drop policy if exists "ref roster update" on public.ref_roster;
drop policy if exists "ref roster delete" on public.ref_roster;

-- Ref OS currently uses a shared event password rather than Supabase Auth,
-- so the anon client needs roster access. The table contains only ref display names.
create policy "ref roster read" on public.ref_roster for select to anon, authenticated using (true);
create policy "ref roster insert" on public.ref_roster for insert to anon, authenticated with check (true);
create policy "ref roster update" on public.ref_roster for update to anon, authenticated using (true) with check (true);
create policy "ref roster delete" on public.ref_roster for delete to anon, authenticated using (true);
