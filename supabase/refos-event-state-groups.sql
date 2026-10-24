-- Public event location only, for grouping the event selector before login.
-- Does not expose other settings, access codes, or member information.
create or replace function public.list_refos_event_locations()
returns table(event_id uuid, location text, state text)
language sql stable security definer set search_path=public
as $$
 select e.id, left(coalesce(v.value->>'location',''),1000),
 left(coalesce(v.value->>'state',v.value->>'region',''),50)
 from public.events e
 left join public.event_settings v on v.event_id=e.id and v.key='vex_event';
$$;
revoke all on function public.list_refos_event_locations() from public;
grant execute on function public.list_refos_event_locations() to anon, authenticated;
