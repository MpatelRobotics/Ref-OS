-- Directory metadata for events already visible through the public discovery RPC.
create or replace function public.list_refos_event_directory_locations()
returns table(event_id uuid, location text, state text, country text)
language sql stable security definer set search_path=public as $$
 select visible.event_id,
  case when saved.value is null then visible.location else '' end,
  left(coalesce(saved.value->>'state',visible.state,''),80),
  left(coalesce(saved.value->>'country',imported.value->>'country',''),80)
 from public.list_refos_event_locations() visible
 left join public.event_settings saved on saved.event_id=visible.event_id and saved.key='event_location'
 left join public.event_settings imported on imported.event_id=visible.event_id and imported.key='vex_event';
$$;
revoke all on function public.list_refos_event_directory_locations() from public;
grant execute on function public.list_refos_event_directory_locations() to anon,authenticated;
