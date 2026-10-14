-- Run after the latest judge-groups.sql. Group judges may change only their own interviews.
begin;
create or replace function public.judge_group_dashboard(p_event uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare group_name text; interviews jsonb; assigned text[];
begin
 select s.group_name into group_name from public.judge_group_sessions s join public.judge_group_credentials c on c.event_id=s.event_id and c.group_name=s.group_name and c.generation=s.generation and c.enabled where s.event_id=p_event and s.user_id=auth.uid() and s.expires_at>now();
 if group_name is null then raise exception 'Judge-group login expired or disabled';end if;
 select coalesce(jsonb_agg(item||jsonb_build_object('session_id',s.session_id,'session_name',coalesce(l.name,'Tournament'),'schedule_version',s.version,'interviewed',coalesce((s.value->'completions') ? (item->>'team'),false) or item->>'status'='completed') order by item->>'start'),'[]'::jsonb) into interviews
 from public.judging_interview_schedules s left join public.league_sessions l on l.id=s.session_id cross join lateral (select value as item from jsonb_array_elements(s.value->'entries') union all select jsonb_build_object('id','assignment-'||team,'team',team,'group',g->>'name','minutes',coalesce(s.value->'duration','10'::jsonb),'status','Not yet scheduled') from jsonb_array_elements(coalesce(s.value->'groups','[]'::jsonb)) g cross join lateral jsonb_array_elements_text(g->'teams') team where not exists(select 1 from jsonb_array_elements(s.value->'entries') e where e->>'team'=team)) assignment
 where s.event_id=p_event and trim(assignment.item->>'group')=group_name;
 select coalesce(array_agg(distinct value->>'team'),array[]::text[]) into assigned from jsonb_array_elements(interviews);
 return jsonb_build_object('group',group_name,'interviews',interviews,
 'timezone',coalesce((select value->>'zone' from public.event_settings where event_id=p_event and key='event_timezone'),'UTC'),
 'teams',coalesce((select jsonb_agg(jsonb_build_object('number',number,'name',name)) from public.teams where event_id=p_event and number=any(assigned)),'[]'::jsonb),
 'matches',coalesce((select jsonb_agg(to_jsonb(m)) from public.matches m where m.event_id=p_event and (m.red&&assigned or m.blue&&assigned)
 and exists(select 1 from jsonb_array_elements(interviews) i where (i->>'session_id')::uuid is not distinct from m.session_id and (i->>'team'=any(m.red) or i->>'team'=any(m.blue)))),'[]'::jsonb),
 'match_index',coalesce((select jsonb_agg(jsonb_build_object('phase',m.phase,'num',m.num,'division_id',m.division_id,'session_id',m.session_id,'redScore',m.red_score,'blueScore',m.blue_score)) from public.matches m where m.event_id=p_event and exists(select 1 from jsonb_array_elements(interviews) i where (i->>'session_id')::uuid is not distinct from m.session_id)),'[]'::jsonb),
 'settings',coalesce((select jsonb_agg(jsonb_build_object('key',key,'value',case when key like '%tm_match_times%' then jsonb_set(value,'{rows}',coalesce((select jsonb_agg(r) from jsonb_array_elements(value->'rows') r where exists(select 1 from jsonb_array_elements_text(coalesce(r->'red','[]'::jsonb)||coalesce(r->'blue','[]'::jsonb)) t where t=any(assigned))),'[]'::jsonb)) else value end)) from public.event_settings where event_id=p_event and key ~ '^(division:[0-9]+:)?tm_(match_times|field_activity)(@.*)?$'),'[]'::jsonb));
end;$$;

create or replace function public.reschedule_judge_group_interview(p_event uuid,p_session uuid,p_team text,p_division integer,p_phase text,p_match integer,p_version integer,p_start timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g text;s public.judging_interview_schedules%rowtype;e jsonb;v jsonb;timing jsonb;match_time timestamptz;candidate timestamptz;anchor timestamptz;limit_time timestamptz;minutes integer;buffer integer;key_name text;idx integer;ok boolean;iteration integer;planning jsonb;
begin
 perform public.judge_group_dashboard(p_event);
 select group_name into g from public.judge_group_sessions where event_id=p_event and user_id=auth.uid();
 select * into s from public.judging_interview_schedules where event_id=p_event and session_id is not distinct from p_session for update;
 if not found or s.version<>p_version or p_version is null then raise exception 'Schedule changed. Refresh schedules and try again.';end if;
 select value into e from jsonb_array_elements(s.value->'entries') where value->>'team'=p_team;
 if e is not null and trim(e->>'group') is distinct from g then raise exception 'This team is not assigned to your judge group';end if;
 if e is null then
 if not exists(select 1 from jsonb_array_elements(coalesce(s.value->'groups','[]'::jsonb)) groups where groups->>'name'=g and groups->'teams' ? p_team) then raise exception 'This team is not assigned to your judge group';end if;
 e=jsonb_build_object('id',gen_random_uuid()::text,'team',p_team,'group',g,'panel',g,'minutes',coalesce(s.value->'duration','10'::jsonb),'buffer',coalesce(s.value->'planning'->'buffer','0'::jsonb));
 end if;
 if not exists(select 1 from public.matches where event_id=p_event and session_id is not distinct from p_session and division_id=p_division and phase=p_phase and num=p_match and (p_team=any(red) or p_team=any(blue))) then raise exception 'Choose a match for this team in this session/division';end if;
 key_name=(case when p_division>0 then 'division:'||p_division||':' else '' end)||'tm_match_times'||(case when p_session is null then '' else '@'||p_session end);
 select value into timing from public.event_settings where event_id=p_event and key=key_name;
 select (value->>'scheduledAt')::timestamptz into match_time from jsonb_array_elements(coalesce(timing->'rows','[]'::jsonb)) where value->>'phase'=p_phase and (value->>'num')::integer=p_match;
 if match_time is null then raise exception 'Scheduled time unavailable for this match. Import match times or refresh TM first.';end if;
 minutes=(e->>'minutes')::integer;buffer=coalesce((e->>'buffer')::integer,0);planning=s.value->'planning';
 anchor=greatest(match_time+interval '10 minutes',date_trunc('minute',now())+interval '1 minute');
 if planning->>'start' is not null then anchor=greatest(anchor,(planning->>'start')::timestamptz);end if;
 limit_time=anchor+interval '8 hours';if planning->>'end' is not null then limit_time=least(limit_time,(planning->>'end')::timestamptz);end if;
 for iteration in 0..480 loop
 candidate=case when p_start is null then anchor+make_interval(mins=>iteration) else p_start end;
 if candidate<anchor or candidate+make_interval(mins=>minutes+buffer)>limit_time then if p_start is not null then raise exception 'Proposed time is outside the available interview window. Refresh and try again.';end if;exit;end if;
 ok=not exists(select 1 from jsonb_array_elements(s.value->'entries') other where other->>'team'<>p_team and (lower(trim(other->>'group'))=lower(g) or lower(trim(other->>'panel'))=lower(trim(e->>'panel'))) and candidate<(other->>'start')::timestamptz+make_interval(mins=>(other->>'minutes')::integer+coalesce((other->>'buffer')::integer,0)) and (other->>'start')::timestamptz<candidate+make_interval(mins=>minutes+buffer));
 if ok then
 ok=not exists(select 1 from public.event_settings settings cross join lateral jsonb_array_elements(coalesce(settings.value->'rows','[]'::jsonb)) times where settings.event_id=p_event and settings.key ~ '^(division:[0-9]+:)?tm_match_times(@.*)?$' and (case when p_session is null then settings.key not like '%@%' else right(settings.key,37)='@'||p_session end) and (times->'red' ? p_team or times->'blue' ? p_team) and candidate<(times->>'scheduledAt')::timestamptz+interval '10 minutes' and (times->>'scheduledAt')::timestamptz-interval '10 minutes'<candidate+make_interval(mins=>minutes+buffer));
 end if;
 if ok and planning->>'lunchMode'='avoid' then ok=not(candidate<(planning->>'lunchEnd')::timestamptz and (planning->>'lunchStart')::timestamptz<candidate+make_interval(mins=>minutes+buffer));end if;
 if ok and planning->>'lunchMode'='only' then ok=candidate>=(planning->>'lunchStart')::timestamptz and candidate+make_interval(mins=>minutes+buffer)<=(planning->>'lunchEnd')::timestamptz;end if;
 if ok then
 if p_start is null then return jsonb_build_object('start',to_char(candidate at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));end if;
 e=e||jsonb_build_object('start',to_char(candidate at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'status','rescheduled','afterMatch',jsonb_build_object('phase',p_phase,'num',p_match,'division',p_division));
 select coalesce(jsonb_agg(value),'[]'::jsonb) into v from jsonb_array_elements(s.value->'entries') where value->>'team'<>p_team;
 update public.judging_interview_schedules set value=jsonb_set(jsonb_set(s.value,'{entries}',v||jsonb_build_array(e)),'{completions}',coalesce(s.value->'completions','{}'::jsonb)-p_team),version=version+1,updated_at=now() where event_id=p_event and session_id is not distinct from p_session;
 return jsonb_build_object('ok',true,'start',e->>'start');
 end if;
 if p_start is not null then raise exception 'This time now conflicts with another interview or match. Refresh and try again.';end if;
 end loop;
 raise exception 'No free interview window after this match. Ask the Judge Advisor to extend the window or adjust lunch rules.';
end;$$;
revoke all on function public.reschedule_judge_group_interview(uuid,uuid,text,integer,text,integer,integer,timestamptz) from public,anon;
grant execute on function public.reschedule_judge_group_interview(uuid,uuid,text,integer,text,integer,integer,timestamptz) to authenticated;
create or replace function public.mark_judge_group_interview(p_event uuid,p_session uuid,p_team text,p_version integer,p_done boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare access jsonb;s public.judging_interview_schedules%rowtype;g text;completed jsonb;v jsonb;
begin
 access=public.judge_group_dashboard(p_event);g=access->>'group';
 if not exists(select 1 from jsonb_array_elements(access->'interviews') i where i->>'team'=p_team and (i->>'session_id')::uuid is not distinct from p_session) then raise exception 'This team is not assigned to your judge group';end if;
 select * into s from public.judging_interview_schedules where event_id=p_event and session_id is not distinct from p_session for update;
 if not found or p_version is null or s.version<>p_version then raise exception 'Schedule changed. Refresh schedules and try again.';end if;
 if p_done is null then raise exception 'Choose interviewed or pending';end if;
 completed=coalesce(s.value->'completions','{}'::jsonb);
 if p_done then completed=completed||jsonb_build_object(p_team,jsonb_build_object('group',g,'completedAt',now()));else completed=completed-p_team;end if;
 v=s.value;if not p_done then select coalesce(jsonb_agg(case when value->>'team'=p_team and value->>'status'='completed' then value||jsonb_build_object('status','scheduled') else value end),'[]'::jsonb) into completed from jsonb_array_elements(v->'entries');v=jsonb_set(v,'{entries}',completed);completed=coalesce(s.value->'completions','{}'::jsonb)-p_team;end if;
 update public.judging_interview_schedules set value=jsonb_set(v,'{completions}',completed),version=version+1,updated_at=now() where event_id=p_event and session_id is not distinct from p_session;
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.mark_judge_group_interview(uuid,uuid,text,integer,boolean) from public,anon;
grant execute on function public.mark_judge_group_interview(uuid,uuid,text,integer,boolean) to authenticated;
commit;
