-- Publish only the linked event code for events already visible in the directory.
create or replace function public.list_refos_event_links()
returns table(event_id uuid, event_code text)
language sql stable security definer set search_path=public as $$
 select visible.event_id, upper(trim(v.value->>'code'))
 from public.list_refos_events() visible
 join public.event_settings v on v.event_id=visible.event_id and v.key='vex_event'
 where upper(trim(v.value->>'code')) ~ '^(RE|VE)-(IQ|VIQRC|VIQC|IQRC|V5|V5RC|VRC|U|VURC|VEXU)-[0-9]{2}-[0-9]{3,8}$';
$$;
revoke all on function public.list_refos_event_links() from public;
grant execute on function public.list_refos_event_links() to anon, authenticated;
