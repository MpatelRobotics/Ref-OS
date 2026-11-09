-- VEX U stays a separate category for every signed-in event role.
-- Existing VEX U events are recognized by their linked code without rewriting event data.
begin;
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

create or replace function public.open_referee_external_event(p_code text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_plan public.referee_external_events%rowtype;v_event uuid;v_outcome text;v_code text:=upper(trim(p_code));
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','true')<>'false' then raise exception 'Sign in to your referee account first';end if;
 select * into v_plan from public.referee_external_events where user_id=auth.uid() and code=v_code;
 if not found then raise exception 'Select this event as attended or going first';end if;
 perform pg_advisory_xact_lock(hashtext('referee-event'),hashtext(v_code));
 select e.id into v_event from public.events e join public.event_settings s on s.event_id=e.id and s.key='vex_event'
 where upper(s.value->>'code')=v_code order by e.created_at limit 1;
 if v_event is null then
  insert into public.events(name,join_code,created_by) values(v_plan.name,gen_random_uuid()::text,auth.uid()) returning id into v_event;
  insert into public.event_settings(event_id,key,value) values
   (v_event,'vex_event',jsonb_build_object('code',v_code,'name',v_plan.name,'location',v_plan.location,'start',v_plan.start_date)),
   (v_event,'competition_program',jsonb_build_object('program',case when v_code ~ '^(RE|VE)-(U|VURC|VEXU)-' then 'vexu' when v_code ~ '(IQ|VIQ)' then 'iq' else 'v5' end));
 end if;
 insert into public.referee_event_plans values(auth.uid(),v_event,v_plan.attendance)
 on conflict(user_id,event_id) do update set attendance=excluded.attendance;
 v_outcome:=public.claim_referee_passcode(v_event,null);
 if v_outcome<>'ok' then raise exception 'Cannot open this event: %',v_outcome;end if;
 return v_event;
end;$$;
commit;
