-- Experimental interview scheduler. Run after base schema and League migrations.
begin;
create table if not exists public.judging_interview_schedules (
 event_id uuid not null references public.events(id) on delete cascade,
 session_id uuid references public.league_sessions(id) on delete cascade,
 session_key uuid generated always as (coalesce(session_id,'00000000-0000-0000-0000-000000000000'::uuid)) stored,
 value jsonb not null default '{"duration":10,"entries":[]}'::jsonb,
 version integer not null default 0,
 updated_at timestamptz not null default now(),
 primary key(event_id,session_key)
);
alter table public.judging_interview_schedules enable row level security;
revoke all on public.judging_interview_schedules from anon,authenticated;
grant select on public.judging_interview_schedules to authenticated;
drop policy if exists "interview schedule reads" on public.judging_interview_schedules;
create policy "interview schedule reads" on public.judging_interview_schedules for select to authenticated using(public.has_event_role(event_id,array['admin','judge']));
create or replace function public.save_judging_interview_schedule(p_event uuid,p_session uuid,p_value jsonb,p_version integer)
returns integer language plpgsql security definer set search_path=public as $$
declare item jsonb; schedule_key uuid; current_version integer;
begin
 if not public.has_event_role(p_event,array['admin','judge']) then raise exception 'Judging access required' using errcode='42501'; end if;
 if p_session is not null and not exists(select 1 from public.league_sessions where id=p_session and event_id=p_event) then raise exception 'Invalid session'; end if;
 if p_value is null or jsonb_typeof(p_value)<>'object' or jsonb_typeof(p_value->'entries') is distinct from 'array' then raise exception 'Invalid schedule'; end if;
 if (p_value->>'duration') is null or (p_value->>'duration') !~ '^[0-9]+$' then raise exception 'Invalid duration'; end if;
 if (p_value->>'duration')::integer not between 1 and 120 or jsonb_array_length(p_value->'entries')>500 then raise exception 'Invalid schedule length'; end if;
 for item in select * from jsonb_array_elements(p_value->'entries') loop
  if jsonb_typeof(item)<>'object' or coalesce(item->>'id','')='' or length(coalesce(item->>'panel','')) not between 1 and 100 or trim(item->>'panel')='' then raise exception 'Invalid interview'; end if;
  if not exists(select 1 from public.teams where event_id=p_event and number=item->>'team') then raise exception 'Unknown team'; end if;
  if coalesce(item->>'minutes','') !~ '^[0-9]+$' then raise exception 'Invalid minutes'; end if;
  if (item->>'minutes')::integer not between 1 and 120 then raise exception 'Invalid minutes'; end if;
  if coalesce(item->>'start','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$' then raise exception 'Invalid time'; end if;
  perform (item->>'start')::timestamptz;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_value->'entries') a group by a->>'team' having count(*)>1) or exists(select 1 from jsonb_array_elements(p_value->'entries') a group by a->>'id' having count(*)>1) then raise exception 'Duplicate interview'; end if;
 if exists(select 1 from jsonb_array_elements(p_value->'entries') with ordinality a(item,idx) cross join jsonb_array_elements(p_value->'entries') with ordinality b(item,idx)
  where a.idx<b.idx and lower(trim(a.item->>'panel'))=lower(trim(b.item->>'panel'))
  and (a.item->>'start')::timestamptz<(b.item->>'start')::timestamptz+make_interval(mins=>(b.item->>'minutes')::integer)
  and (b.item->>'start')::timestamptz<(a.item->>'start')::timestamptz+make_interval(mins=>(a.item->>'minutes')::integer)) then raise exception 'Panel interviews overlap'; end if;
 schedule_key=coalesce(p_session,'00000000-0000-0000-0000-000000000000'::uuid);
 insert into public.judging_interview_schedules(event_id,session_id) values(p_event,p_session) on conflict(event_id,session_key) do nothing;
 select version into current_version from public.judging_interview_schedules where event_id=p_event and session_key=schedule_key for update;
 if p_version is null or current_version<>p_version then raise exception 'Schedule changed' using errcode='40001'; end if;
 update public.judging_interview_schedules set value=p_value,version=current_version+1,updated_at=now() where event_id=p_event and session_key=schedule_key;
 return current_version+1;
end;
$$;
revoke all on function public.save_judging_interview_schedule(uuid,uuid,jsonb,integer) from public,anon;
grant execute on function public.save_judging_interview_schedule(uuid,uuid,jsonb,integer) to authenticated;
commit;
