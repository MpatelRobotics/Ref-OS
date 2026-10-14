-- Run after judge-group-reschedule.sql. Declarations are required before new group assignments.
begin;
create table if not exists public.judge_group_conflicts(
 event_id uuid not null,group_name text not null,conflict_teams text[] not null default '{}',affiliations text not null default '',version integer not null default 0,updated_at timestamptz not null default now(),
 primary key(event_id,group_name),foreign key(event_id,group_name) references public.judge_group_credentials(event_id,group_name) on delete cascade
);
alter table public.judge_group_conflicts enable row level security;
revoke all on public.judge_group_conflicts from anon,authenticated;
create or replace function public.list_judge_group_conflicts(p_event uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.has_event_role(p_event,array['admin','judge']) then raise exception 'Judge Advisor access required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('name',c.group_name,'enabled',c.enabled,'conflict_teams',coalesce(f.conflict_teams,'{}'::text[]),'affiliations',coalesce(f.affiliations,''),'version',coalesce(f.version,0))) from public.judge_group_credentials c left join public.judge_group_conflicts f on f.event_id=c.event_id and f.group_name=c.group_name where c.event_id=p_event),'[]'::jsonb);
end;$$;
create or replace function public.my_judge_group_conflicts(p_event uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare g text;
begin
 g=public.judge_group_dashboard(p_event)->>'group';
 return coalesce((select jsonb_build_object('name',group_name,'conflict_teams',conflict_teams,'affiliations',affiliations,'version',version) from public.judge_group_conflicts where event_id=p_event and group_name=g),jsonb_build_object('name',g,'conflict_teams','[]'::jsonb,'affiliations','','version',0));
end;$$;
create or replace function public.save_judge_group_conflicts(p_event uuid,p_group text,p_teams text[],p_affiliations text,p_version integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare g text;current_version integer;
begin
 if not public.has_event_role(p_event,array['admin','judge']) then g=public.judge_group_dashboard(p_event)->>'group';if p_group is distinct from g then raise exception 'You can declare conflicts only for your own group';end if;end if;
 perform 1 from public.judge_group_credentials where event_id=p_event and group_name=p_group for update;if not found then raise exception 'Create this group login first';end if;
 if p_teams is null or cardinality(p_teams)>500 or p_affiliations is null or length(p_affiliations)>2000 then raise exception 'Invalid conflict declaration';end if;
 if exists(select 1 from unnest(p_teams) team where not exists(select 1 from public.teams where event_id=p_event and number=team)) then raise exception 'A conflict team is not in the event roster. Use exact team numbers.';end if;
 insert into public.judge_group_conflicts(event_id,group_name) values(p_event,p_group) on conflict do nothing;
 select version into current_version from public.judge_group_conflicts where event_id=p_event and group_name=p_group for update;
 if p_version is null or p_version<>current_version then raise exception 'Conflict declaration changed. Reload before editing.';end if;
 update public.judge_group_conflicts set conflict_teams=array(select distinct t from unnest(p_teams) t),affiliations=p_affiliations,version=version+1,updated_at=now() where event_id=p_event and group_name=p_group;
 return jsonb_build_object('ok',true);
end;$$;
create or replace function public.enforce_judge_conflicts() returns trigger language plpgsql security definer set search_path=public as $$
declare old_pairs jsonb;new_pairs jsonb;pair jsonb;profile public.judge_group_conflicts%rowtype;
begin
 old_pairs='[]'::jsonb;if tg_op='UPDATE' then
 select coalesce(jsonb_agg(jsonb_build_object('team',team,'group',name)),'[]'::jsonb) into old_pairs from (select e->>'team' team,trim(e->>'group') name from jsonb_array_elements(old.value->'entries') e where coalesce(trim(e->>'group'),'')<>'' union select t,g->>'name' from jsonb_array_elements(coalesce(old.value->'groups','[]'::jsonb)) g cross join lateral jsonb_array_elements_text(g->'teams') t) pairs;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('team',team,'group',name)),'[]'::jsonb) into new_pairs from (select e->>'team' team,trim(e->>'group') name from jsonb_array_elements(new.value->'entries') e where coalesce(trim(e->>'group'),'')<>'' union select t,g->>'name' from jsonb_array_elements(coalesce(new.value->'groups','[]'::jsonb)) g cross join lateral jsonb_array_elements_text(g->'teams') t) pairs;
 for pair in select value from jsonb_array_elements(new_pairs) loop
 if not old_pairs @> jsonb_build_array(pair) then
 perform 1 from public.judge_group_credentials where event_id=new.event_id and group_name=pair->>'group' for update;
 select * into profile from public.judge_group_conflicts where event_id=new.event_id and group_name=pair->>'group';
 if not found or profile.version=0 then raise exception 'Each assigned judge group must submit a conflict declaration first';end if;
 if pair->>'team'=any(profile.conflict_teams) then raise exception 'This team conflicts with its assigned judge group';end if;
 end if;end loop;return new;
end;$$;
drop trigger if exists enforce_judge_conflicts on public.judging_interview_schedules;
create trigger enforce_judge_conflicts before insert or update on public.judging_interview_schedules for each row execute function public.enforce_judge_conflicts();
create or replace function public.reassign_judge_team(p_event uuid,p_session uuid,p_team text,p_target text,p_version integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.judging_interview_schedules%rowtype;new_groups jsonb;group_item jsonb;list jsonb;entries jsonb;profile public.judge_group_conflicts%rowtype;
begin
 if not public.has_event_role(p_event,array['admin','judge']) then raise exception 'Judge Advisor access required';end if;
 select * into s from public.judging_interview_schedules where event_id=p_event and session_id is not distinct from p_session for update;
 if not found or p_version is null or s.version<>p_version then raise exception 'Schedule changed. Refresh before moving the team.';end if;

 perform 1 from public.judge_group_credentials where event_id=p_event and group_name=p_target and enabled for update;if not found then raise exception 'Enable the target group login first';end if;
 select * into profile from public.judge_group_conflicts where event_id=p_event and group_name=p_target;
 if not found or profile.version=0 then raise exception 'Target group must declare conflicts first';end if;
 if p_team=any(profile.conflict_teams) then raise exception 'This team conflicts with the target judge group';end if;
 if not exists(select 1 from jsonb_array_elements(s.value->'entries') e where e->>'team'=p_team) and not exists(select 1 from jsonb_array_elements(coalesce(s.value->'groups','[]'::jsonb)) g where g->'teams' ? p_team) then raise exception 'Team is not assigned in this session';end if;
 new_groups='[]'::jsonb;for group_item in select value from jsonb_array_elements(coalesce(s.value->'groups','[]'::jsonb)) loop
 select coalesce(jsonb_agg(value),'[]'::jsonb) into list from jsonb_array_elements(group_item->'teams') where value<>to_jsonb(p_team);
 new_groups=new_groups||jsonb_build_array(group_item||jsonb_build_object('teams',list));end loop;
 if not exists(select 1 from jsonb_array_elements(new_groups) items(value) where items.value->>'name'=p_target) then new_groups=new_groups||jsonb_build_array(jsonb_build_object('name',p_target,'teams','[]'::jsonb));end if;
 select jsonb_agg(case when items.value->>'name'=p_target then items.value||jsonb_build_object('teams',(items.value->'teams')||jsonb_build_array(p_team)) else items.value end) into new_groups from jsonb_array_elements(new_groups) items(value);
 select coalesce(jsonb_agg(value),'[]'::jsonb) into entries from jsonb_array_elements(s.value->'entries') where value->>'team'<>p_team;
 update public.judging_interview_schedules set value=jsonb_set(jsonb_set(jsonb_set(s.value,'{groups}',new_groups),'{entries}',entries),'{completions}',coalesce(s.value->'completions','{}'::jsonb)-p_team),version=version+1,updated_at=now() where event_id=p_event and session_id is not distinct from p_session;
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.list_judge_group_conflicts(uuid),public.my_judge_group_conflicts(uuid),public.save_judge_group_conflicts(uuid,text,text[],text,integer),public.reassign_judge_team(uuid,uuid,text,text,integer) from public,anon;
grant execute on function public.list_judge_group_conflicts(uuid),public.my_judge_group_conflicts(uuid),public.save_judge_group_conflicts(uuid,text,text[],text,integer),public.reassign_judge_team(uuid,uuid,text,text,integer) to authenticated;
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

create or replace function public.mark_judge_group_interview(p_event uuid,p_session uuid,p_team text,p_version integer,p_done boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare access jsonb;s public.judging_interview_schedules%rowtype;g text;completed jsonb;v jsonb;
begin
 access=public.judge_group_dashboard(p_event);g=access->>'group';
 if not exists(select 1 from public.judge_group_conflicts where event_id=p_event and group_name=g and version>0) then raise exception 'Declare group conflicts first';end if;
 if exists(select 1 from public.judge_group_conflicts where event_id=p_event and group_name=g and p_team=any(conflict_teams)) then raise exception 'This team is a declared conflict. Ask the Judge Advisor to reassign it.';end if;
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

commit;
