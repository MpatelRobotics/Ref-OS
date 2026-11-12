-- Expose only the program of events already visible in the public selector.
create or replace function public.list_refos_event_programs()
returns table(event_id uuid, program text)
language sql stable security definer set search_path=public as $$
 select visible.event_id,
  case when s.value->>'program' in ('iq','vexu') then s.value->>'program'
       when v.value->>'code' ~* '^(RE|VE)-(U|VURC|VEXU)-' then 'vexu'
       when v.value->>'code' ~* '^(RE|VE)-(IQ|VIQRC|VIQC|IQRC)-' then 'iq'
       else 'v5' end
 from public.list_refos_events() visible
 left join public.event_settings s on s.event_id=visible.event_id and s.key='competition_program'
 left join public.event_settings v on v.event_id=visible.event_id and v.key='vex_event';
$$;
revoke all on function public.list_refos_event_programs() from public;
grant execute on function public.list_refos_event_programs() to anon, authenticated;
