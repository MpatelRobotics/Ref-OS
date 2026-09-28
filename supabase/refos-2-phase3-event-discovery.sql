-- Ref OS 2.0 Phase 3 event discovery
-- Exposes only the event ID and display name needed by the pre-login selector.
-- It does not expose members, access credentials, event data, or credential hashes.
-- Safe to rerun.

create or replace function public.list_refos_events()
returns table(
  event_id uuid,
  event_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.name
  from public.events e
  order by e.created_at desc, e.name asc;
$$;

revoke all on function public.list_refos_events() from public;
grant execute on function public.list_refos_events() to anon, authenticated;
