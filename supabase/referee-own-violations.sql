-- Run once in the Supabase SQL Editor before deploying the app update.
-- Earlier violations have no reliable user ID; only admins can edit or delete them.
alter table public.violations
  add column if not exists logged_by_user uuid default auth.uid();

drop policy if exists "refs write violations" on public.violations;
drop policy if exists "members rw violations" on public.violations;
drop policy if exists "open rw violations" on public.violations;
drop policy if exists "refs insert own violations" on public.violations;
drop policy if exists "refs update own violations" on public.violations;
drop policy if exists "refs delete own violations" on public.violations;

create policy "refs insert own violations" on public.violations for insert
  with check (public.has_event_role(event_id,array['ref','admin']) and logged_by_user = auth.uid());
create policy "refs update own violations" on public.violations for update
  using (public.has_event_role(event_id,array['admin']) or (public.has_event_role(event_id,array['ref']) and logged_by_user = auth.uid()))
  with check (public.has_event_role(event_id,array['admin']) or (public.has_event_role(event_id,array['ref']) and logged_by_user = auth.uid()));
create policy "refs delete own violations" on public.violations for delete
  using (public.has_event_role(event_id,array['admin']) or (public.has_event_role(event_id,array['ref']) and logged_by_user = auth.uid()));
