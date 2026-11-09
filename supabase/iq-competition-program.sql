-- Read-only competition program for all signed-in event roles, including Inspection.
-- Run after schema.sql and refos-2-phase6-event-settings.sql. Safe to rerun.
create or replace function public.get_event_competition_program(p_event uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select case when s.value->>'program' in ('iq','vexu') then s.value->>'program'
    when v.value->>'code' ~* '^(RE|VE)-(U|VURC|VEXU)-' then 'vexu' else 'v5' end
  from public.events e
  left join public.event_settings s on s.event_id = e.id and s.key = 'competition_program'
  left join public.event_settings v on v.event_id = e.id and v.key = 'vex_event'
  where e.id = p_event
    and public.has_event_role(p_event, array['ref','judge','emcee','inspection','admin']);
$$;
revoke all on function public.get_event_competition_program(uuid) from public, anon;
grant execute on function public.get_event_competition_program(uuid) to authenticated;
