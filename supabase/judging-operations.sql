-- Run after judge-group-management.sql.
begin;
create table if not exists public.judging_operations (
 event_id uuid not null references public.events(id) on delete cascade,
 kind text not null check(kind in ('group','team','availability')),
 subject text not null, session_id uuid, session_key uuid generated always as (coalesce(session_id,'00000000-0000-0000-0000-000000000000'::uuid)) stored,
 value jsonb not null default '{}', version integer not null default 0,updated_at timestamptz not null default now(),
 primary key(event_id,kind,subject,session_key)
);
alter table public.judging_operations enable row level security;
revoke all on public.judging_operations from anon,authenticated;
create or replace function public.list_judging_operations(p_event uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare g text;dashboard jsonb;
begin
 if public.has_event_role(p_event,array['admin','judge']) then
 return coalesce((select jsonb_agg(to_jsonb(o)) from public.judging_operations o where event_id=p_event),'[]');end if;
 dashboard=public.judge_group_dashboard(p_event);g=dashboard->>'group';
 return coalesce((select jsonb_agg(to_jsonb(o)) from public.judging_operations o where event_id=p_event and ((kind='group' and subject=g) or (kind in ('team','availability') and exists(select 1 from jsonb_array_elements(dashboard->'interviews') i where i->>'team'=o.subject and (o.kind='team' or (i->>'session_id')::uuid is not distinct from o.session_id))))),'[]');
end;$$;
create or replace function public.save_judging_operation(p_event uuid,p_kind text,p_subject text,p_session uuid,p_value jsonb,p_version integer) returns integer language plpgsql security definer set search_path=public as $$
declare dashboard jsonb;v integer;
begin
 if p_kind not in ('group','team','availability') or p_subject is null or length(p_subject)>100 or jsonb_typeof(p_value)<>'object' or octet_length(p_value::text)>20000 then raise exception 'Invalid judging record';end if;
 if p_kind in ('group','team') and p_session is not null then raise exception 'Preparation records cover the whole event';end if;
 if not public.has_event_role(p_event,array['admin','judge']) then
 if p_kind<>'availability' then raise exception 'Judge Advisor access required';end if;
 dashboard=public.judge_group_dashboard(p_event);
 if not exists(select 1 from jsonb_array_elements(dashboard->'interviews') i where i->>'team'=p_subject and (i->>'session_id')::uuid is not distinct from p_session) then raise exception 'This team is not assigned to your judge group';end if;
 end if;
 if p_kind='group' and not exists(select 1 from public.judge_group_credentials where event_id=p_event and group_name=p_subject) then raise exception 'Create this group login first';end if;
 if p_kind in ('team','availability') and not exists(select 1 from public.teams where event_id=p_event and number=p_subject) then raise exception 'Choose a team at this event';end if;
 if p_kind='team' and (coalesce((p_value->>'extraMinutes')::numeric,0) not between 0 and 60 or coalesce((p_value->>'extraMinutes')::numeric,0)<>trunc(coalesce((p_value->>'extraMinutes')::numeric,0))) then raise exception 'Extra minutes must be 0–60 whole minutes';end if;
 if p_kind='group' and jsonb_typeof(p_value->'judges') is distinct from 'array' then raise exception 'Enter a judge roster';end if;
 if p_kind='group' and exists(select 1 from jsonb_array_elements(p_value->'judges') j where coalesce(length(trim(j->>'name')),0) not between 1 and 100 or coalesce(j->>'experience','') not in ('new','experienced') or length(coalesce(j->>'languages',''))>300 or jsonb_typeof(j->'arrived') is distinct from 'boolean') then raise exception 'Each judge needs a name, experience and attendance';end if;
 if p_kind='team' and (length(coalesce(p_value->>'language',''))>100 or length(coalesce(p_value->>'accommodations',''))>2000) then raise exception 'Team request is too long';end if;
 if p_kind='availability' and ((p_value->>'reason') is null or (p_value->>'reason') not in ('available','in queue','at Skills','repairing','not at pit','other')) then raise exception 'Choose an availability reason';end if;
 if p_kind='availability' and p_value->>'returnAt' is not null and p_value->>'returnAt'<>'' then perform (p_value->>'returnAt')::timestamptz;end if;
 insert into public.judging_operations(event_id,kind,subject,session_id) values(p_event,p_kind,p_subject,p_session) on conflict do nothing;
 select version into v from public.judging_operations where event_id=p_event and kind=p_kind and subject=p_subject and session_id is not distinct from p_session for update;
 if p_version is null or v<>p_version then raise exception 'Record changed. Reload before saving.';end if;
 update public.judging_operations set value=p_value,version=version+1,updated_at=now() where event_id=p_event and kind=p_kind and subject=p_subject and session_id is not distinct from p_session;
 return v+1;
end;$$;
create table if not exists public.judge_assignment_history(
 id bigint generated always as identity primary key,event_id uuid references public.events(id) on delete cascade,session_id uuid,team text,from_group text,to_group text,actor uuid,actor_name text,changed_at timestamptz not null default now()
);
alter table public.judge_assignment_history enable row level security;
revoke all on public.judge_assignment_history from anon,authenticated;
create or replace function public.audit_judge_assignments() returns trigger language plpgsql security definer set search_path=public as $$
declare before_map jsonb='{}';after_map jsonb='{}';g jsonb;e jsonb;t text;
begin
 if tg_op='UPDATE' then
 for g in select value from jsonb_array_elements(coalesce(old.value->'groups','[]')) loop for t in select jsonb_array_elements_text(g->'teams') loop before_map=before_map||jsonb_build_object(t,g->>'name');end loop;end loop;
 for e in select value from jsonb_array_elements(coalesce(old.value->'entries','[]')) loop before_map=before_map||jsonb_build_object(e->>'team',e->>'group');end loop;
 end if;
 for g in select value from jsonb_array_elements(coalesce(new.value->'groups','[]')) loop for t in select jsonb_array_elements_text(g->'teams') loop after_map=after_map||jsonb_build_object(t,g->>'name');end loop;end loop;
 for e in select value from jsonb_array_elements(coalesce(new.value->'entries','[]')) loop after_map=after_map||jsonb_build_object(e->>'team',e->>'group');end loop;
 for t in select jsonb_object_keys(before_map||after_map) loop if before_map->>t is distinct from after_map->>t then
 insert into public.judge_assignment_history(event_id,session_id,team,from_group,to_group,actor,actor_name) values(new.event_id,new.session_id,t,before_map->>t,after_map->>t,auth.uid(),(select name from public.profiles where id=auth.uid()));end if;end loop;
 return new;
end;$$;
drop trigger if exists audit_judge_assignments on public.judging_interview_schedules;
create trigger audit_judge_assignments after insert or update on public.judging_interview_schedules for each row execute function public.audit_judge_assignments();
create or replace function public.list_judge_assignment_history(p_event uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.has_event_role(p_event,array['admin','judge']) then raise exception 'Judge Advisor access required';end if;
 return coalesce((select jsonb_agg(to_jsonb(h) order by changed_at desc,id desc) from public.judge_assignment_history h where event_id=p_event),'[]');
end;$$;
create or replace function public.cleanup_judging_group_preparation() returns trigger language plpgsql security definer set search_path=public as $$begin delete from public.judging_operations where event_id=old.event_id and kind='group' and subject=old.group_name;return old;end;$$;
drop trigger if exists cleanup_judging_group_preparation on public.judge_group_credentials;
create trigger cleanup_judging_group_preparation after delete on public.judge_group_credentials for each row execute function public.cleanup_judging_group_preparation();
revoke all on function public.list_judging_operations(uuid),public.save_judging_operation(uuid,text,text,uuid,jsonb,integer),public.list_judge_assignment_history(uuid),public.audit_judge_assignments(),public.cleanup_judging_group_preparation() from public,anon;
grant execute on function public.list_judging_operations(uuid),public.save_judging_operation(uuid,text,text,uuid,jsonb,integer),public.list_judge_assignment_history(uuid) to authenticated;

create or replace function public.enforce_judging_language() returns trigger language plpgsql security definer set search_path=public as $$
declare g jsonb;t text;requested text;roster jsonb;
begin
 for g in select value from jsonb_array_elements(coalesce(new.value->'groups','[]')) union all select jsonb_build_object('name',e->>'group','teams',jsonb_build_array(e->>'team')) from jsonb_array_elements(coalesce(new.value->'entries','[]')) e loop
 for t in select jsonb_array_elements_text(g->'teams') loop
 if tg_op='UPDATE' and (exists(select 1 from jsonb_array_elements(coalesce(old.value->'groups','[]')) x where x->>'name'=g->>'name' and x->'teams' ? t) or exists(select 1 from jsonb_array_elements(coalesce(old.value->'entries','[]')) x where x->>'group'=g->>'name' and x->>'team'=t)) then continue;end if;
 select lower(trim(value->>'language')) into requested from public.judging_operations where event_id=new.event_id and kind='team' and subject=t;
 if coalesce(requested,'')<>'' then
 select value->'judges' into roster from public.judging_operations where event_id=new.event_id and kind='group' and subject=g->>'name';
 if not exists(select 1 from jsonb_array_elements(coalesce(roster,'[]')) j cross join lateral regexp_split_to_table(coalesce(j->>'languages',''), '[,;]') language where lower(trim(language))=requested) then raise exception 'Target group cannot support the requested interview language for %',t;end if;
 end if;
 end loop;end loop;return new;
end;$$;
drop trigger if exists enforce_judging_language on public.judging_interview_schedules;
create trigger enforce_judging_language before insert or update on public.judging_interview_schedules for each row execute function public.enforce_judging_language();
revoke all on function public.enforce_judging_language() from public,anon,authenticated;

create or replace function public.judge_group_dashboard(p_event uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare group_name text; interviews jsonb; assigned text[];
begin
 select s.group_name into group_name from public.judge_group_sessions s join public.judge_group_credentials c on c.event_id=s.event_id and c.group_name=s.group_name and c.generation=s.generation and c.enabled where s.event_id=p_event and s.user_id=auth.uid() and s.expires_at>now();
 if group_name is null then raise exception 'Judge-group login expired or disabled';end if;
 select coalesce(jsonb_agg(item||jsonb_build_object('session_id',s.session_id,'session_name',coalesce(l.name,'Tournament'),'schedule_version',s.version,'planning_end',s.value->'planning'->>'end','interviewed',coalesce((s.value->'completions') ? (item->>'team'),false) or item->>'status'='completed') order by item->>'start'),'[]'::jsonb) into interviews
 from public.judging_interview_schedules s left join public.league_sessions l on l.id=s.session_id cross join lateral (select value as item from jsonb_array_elements(s.value->'entries') union all select jsonb_build_object('id','assignment-'||team,'team',team,'group',g->>'name','minutes',coalesce(s.value->'duration','10'::jsonb),'status','Not yet scheduled') from jsonb_array_elements(coalesce(s.value->'groups','[]'::jsonb)) g cross join lateral jsonb_array_elements_text(g->'teams') team where not exists(select 1 from jsonb_array_elements(s.value->'entries') e where e->>'team'=team)) assignment
 where s.event_id=p_event and trim(assignment.item->>'group')=group_name;
 select coalesce(array_agg(distinct value->>'team'),array[]::text[]) into assigned from jsonb_array_elements(interviews);
 return jsonb_build_object('group',group_name,'interviews',interviews,
 'timezone',coalesce((select value->>'zone' from public.event_settings where event_id=p_event and key='event_timezone'),'UTC'),
 'teams',coalesce((select jsonb_agg(jsonb_build_object('number',number,'name',name)) from public.teams where event_id=p_event and number=any(assigned)),'[]'::jsonb),
 'matches',coalesce((select jsonb_agg(to_jsonb(m)) from public.matches m where m.event_id=p_event and (m.red&&assigned or m.blue&&assigned)
 and exists(select 1 from jsonb_array_elements(interviews) i where (i->>'session_id')::uuid is not distinct from m.session_id and (i->>'team'=any(m.red) or i->>'team'=any(m.blue)))),'[]'::jsonb),
 'match_index',coalesce((select jsonb_agg(jsonb_build_object('phase',m.phase,'num',m.num,'division_id',m.division_id,'session_id',m.session_id,'redScore',m.red_score,'blueScore',m.blue_score)) from public.matches m where m.event_id=p_event and exists(select 1 from jsonb_array_elements(interviews) i where (i->>'session_id')::uuid is not distinct from m.session_id)),'[]'::jsonb),
 'settings',coalesce((select jsonb_agg(jsonb_build_object('key',key,'value',case when key like '%tm_match_times%' then jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object('phase',r->'phase','num',r->'num','scheduledAt',r->'scheduledAt')) from jsonb_array_elements(value->'rows') r),'[]'::jsonb)) else value end)) from public.event_settings where event_id=p_event and key ~ '^(division:[0-9]+:)?tm_(match_times|field_activity)(@.*)?$'),'[]'::jsonb));
end;$$;


create or replace function public.reschedule_judge_group_interview(p_event uuid,p_session uuid,p_team text,p_division integer,p_phase text,p_match integer,p_version integer,p_start timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g text;s public.judging_interview_schedules%rowtype;e jsonb;v jsonb;timing jsonb;match_time timestamptz;candidate timestamptz;anchor timestamptz;limit_time timestamptz;minutes integer;buffer integer;key_name text;idx integer;ok boolean;iteration integer;planning jsonb;
begin
 perform public.judge_group_dashboard(p_event);
 select group_name into g from public.judge_group_sessions where event_id=p_event and user_id=auth.uid();
 if not exists(select 1 from public.judge_group_conflicts where event_id=p_event and group_name=g and version>0) then raise exception 'Declare group conflicts first';end if;
 if exists(select 1 from public.judge_group_conflicts where event_id=p_event and group_name=g and p_team=any(conflict_teams)) then raise exception 'This team is a declared conflict. Ask the Judge Advisor to reassign it.';end if;
 select * into s from public.judging_interview_schedules where event_id=p_event and session_id is not distinct from p_session for update;
 if not found or s.version<>p_version or p_version is null then raise exception 'Schedule changed. Refresh schedules and try again.';end if;
 select value into e from jsonb_array_elements(s.value->'entries') where value->>'team'=p_team;
 if e is not null and trim(e->>'group') is distinct from g then raise exception 'This team is not assigned to your judge group';end if;
 if e is null then
 if not exists(select 1 from jsonb_array_elements(coalesce(s.value->'groups','[]'::jsonb)) groups where groups->>'name'=g and groups->'teams' ? p_team) then raise exception 'This team is not assigned to your judge group';end if;
 e=jsonb_build_object('id',gen_random_uuid()::text,'team',p_team,'group',g,'panel',g,'minutes',least(120,coalesce((s.value->>'duration')::integer,10)+coalesce((select (value->>'extraMinutes')::integer from public.judging_operations where event_id=p_event and kind='team' and subject=p_team),0)),'buffer',coalesce(s.value->'planning'->'buffer','0'::jsonb));
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


commit;
