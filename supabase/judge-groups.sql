-- Run after interview-scheduler.sql, event-operations.sql and division migrations.
begin;
create or replace function public.validate_judge_group_assignments()
returns trigger language plpgsql set search_path=public as $$
declare group_item jsonb;assigned_team text;
begin
 if new.value ? 'groups' then
 if jsonb_typeof(new.value->'groups') is distinct from 'array' then raise exception 'Invalid judge groups';end if;
 if jsonb_array_length(new.value->'groups')>10 then raise exception 'Too many judge groups';end if;
 for group_item in select value from jsonb_array_elements(new.value->'groups') loop
 if length(trim(coalesce(group_item->>'name',''))) not between 1 and 100 or jsonb_typeof(group_item->'teams') is distinct from 'array' then raise exception 'Invalid judge group';end if;
 if jsonb_array_length(group_item->'teams')>500 then raise exception 'Too many assigned teams';end if;
 for assigned_team in select value from jsonb_array_elements_text(group_item->'teams') loop
 if not exists(select 1 from public.teams where event_id=new.event_id and number=assigned_team) then raise exception 'Unknown assigned team';end if;
 end loop;end loop;
 if (select count(*) from jsonb_array_elements(new.value->'groups') groups(value) cross join lateral jsonb_array_elements_text(groups.value->'teams') teams(value))>500 then raise exception 'Too many assigned teams';end if;
 if exists(select 1 from jsonb_array_elements(new.value->'groups') names(value) group by lower(trim(names.value->>'name')) having count(*)>1) then raise exception 'Duplicate judge group';end if;
 if exists(select 1 from jsonb_array_elements(new.value->'groups') groups(value) cross join lateral jsonb_array_elements_text(groups.value->'teams') teams(value) group by teams.value having count(*)>1) then raise exception 'Duplicate assigned team';end if;
 end if;return new;
end;$$;
drop trigger if exists validate_judge_group_assignments on public.judging_interview_schedules;
create trigger validate_judge_group_assignments before insert or update on public.judging_interview_schedules for each row execute function public.validate_judge_group_assignments();
create table if not exists public.judge_group_credentials(
 event_id uuid references public.events(id) on delete cascade,
 group_name text not null check(length(trim(group_name)) between 1 and 100),
 code_hash text not null, enabled boolean not null default true,
 generation uuid not null default gen_random_uuid(),primary key(event_id,group_name)
);
create table if not exists public.judge_group_sessions(
 event_id uuid references public.events(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 group_name text not null,generation uuid not null,expires_at timestamptz not null,
 primary key(event_id,user_id)
);
alter table public.judge_group_credentials enable row level security;
alter table public.judge_group_sessions enable row level security;
revoke all on public.judge_group_credentials,public.judge_group_sessions from anon,authenticated;

create or replace function public.create_judge_group_code(p_event uuid,p_group text)
returns text language plpgsql security definer set search_path=public,extensions as $$
declare code text;bytes bytea;
begin
 if not public.has_event_role(p_event,array['admin','judge']) then raise exception 'Judge Advisor access required'; end if;
 if length(trim(p_group)) not between 1 and 100 or p_group is null then raise exception 'Enter a judge group name';end if;
 loop
 bytes=gen_random_bytes(5);code=(get_byte(bytes,0)%10)::text||chr(65+get_byte(bytes,1)%26)||(get_byte(bytes,2)%10)::text||chr(65+get_byte(bytes,3)%26)||(get_byte(bytes,4)%10)::text;
 exit when not exists(select 1 from public.judge_group_credentials where event_id=p_event and code_hash=encode(digest(code,'sha256'),'hex'));
 end loop;
 insert into public.judge_group_credentials(event_id,group_name,code_hash) values(p_event,trim(p_group),encode(digest(code,'sha256'),'hex'))
 on conflict(event_id,group_name) do update set code_hash=excluded.code_hash,enabled=true,generation=gen_random_uuid();
 return code;
end;$$;
create or replace function public.list_judge_group_codes(p_event uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.has_event_role(p_event,array['admin','judge']) then raise exception 'Judge Advisor access required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('name',group_name,'enabled',enabled) order by group_name) from public.judge_group_credentials where event_id=p_event),'[]'::jsonb);
end;$$;
create or replace function public.disable_judge_group_code(p_event uuid,p_group text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.has_event_role(p_event,array['admin','judge']) then raise exception 'Judge Advisor access required';end if;
 update public.judge_group_credentials set enabled=false,generation=gen_random_uuid() where event_id=p_event and group_name=p_group;
end;$$;
create or replace function public.login_judge_group(p_event uuid,p_code text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare credential public.judge_group_credentials%rowtype;attempt public.event_access_attempts%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 insert into public.event_access_attempts(event_id,user_id) values(p_event,auth.uid()) on conflict do nothing;
 select * into attempt from public.event_access_attempts where event_id=p_event and user_id=auth.uid() for update;
 if attempt.locked_until>now() then return jsonb_build_object('ok',false,'message','Too many attempts. Try again in five minutes.');end if;
 select * into credential from public.judge_group_credentials where event_id=p_event and enabled and code_hash=encode(digest(upper(trim(p_code)),'sha256'),'hex');
 if credential.group_name is null then
 update public.event_access_attempts set failed_count=case when window_started<now()-interval '5 minutes' then 1 else failed_count+1 end,
 locked_until=case when window_started>=now()-interval '5 minutes' and failed_count>=4 then now()+interval '5 minutes' else null end,
 window_started=case when window_started<now()-interval '5 minutes' then now() else window_started end where event_id=p_event and user_id=auth.uid();
 return jsonb_build_object('ok',false,'message','Incorrect or disabled judge-group code.');
 end if;
 delete from public.event_access_attempts where event_id=p_event and user_id=auth.uid();
 insert into public.judge_group_sessions values(p_event,auth.uid(),credential.group_name,credential.generation,now()+interval '12 hours')
 on conflict(event_id,user_id) do update set group_name=excluded.group_name,generation=excluded.generation,expires_at=excluded.expires_at;
 return jsonb_build_object('ok',true,'group',credential.group_name);
end;$$;
create or replace function public.logout_judge_group(p_event uuid)
returns void language sql security definer set search_path=public as $$delete from public.judge_group_sessions where event_id=p_event and user_id=auth.uid();$$;
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
revoke all on function public.create_judge_group_code(uuid,text),public.list_judge_group_codes(uuid),public.disable_judge_group_code(uuid,text),public.login_judge_group(uuid,text),public.logout_judge_group(uuid),public.judge_group_dashboard(uuid) from public,anon;
grant execute on function public.create_judge_group_code(uuid,text),public.list_judge_group_codes(uuid),public.disable_judge_group_code(uuid,text),public.login_judge_group(uuid,text),public.logout_judge_group(uuid),public.judge_group_dashboard(uuid) to authenticated;
commit;
