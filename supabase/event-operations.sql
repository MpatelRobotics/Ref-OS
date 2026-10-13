begin;
create table if not exists public.event_operations (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
 session_id uuid references public.league_sessions(id) on delete cascade, division_id integer not null default 0 check(division_id>=0),
 kind text not null check(kind in('announcement','assignment','robot-change','inspection-followup','judge-group','attendance')),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<20000),
 version integer not null default 1, created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.event_operations enable row level security;
create unique index if not exists attendance_one_team_session on public.event_operations(event_id,session_id,(payload->>'team')) where kind='attendance';
drop policy if exists "operations read" on public.event_operations;
create policy "operations read" on public.event_operations for select to authenticated using(public.has_event_role(event_id,case when kind='judge-group' then array['admin','judge'] else array['admin','ref','judge','inspection','emcee'] end));
create or replace function public.save_event_operation(p_event uuid,p_session uuid,p_division integer,p_kind text,p_payload jsonb,p_id uuid default null,p_version integer default 0)
returns public.event_operations language plpgsql security definer set search_path=public as $$
declare row public.event_operations;
begin
 if not public.has_event_role(p_event,case when p_kind='judge-group' then array['admin','judge'] when p_kind in('robot-change','inspection-followup') then array['admin','ref','inspection'] else array['admin'] end) then raise exception 'Event access required' using errcode='42501'; end if;
 if p_session is not null and not exists(select 1 from public.league_sessions where id=p_session and event_id=p_event) then raise exception 'Invalid session'; end if;
 if p_kind in('robot-change','inspection-followup','judge-group','attendance') and not exists(select 1 from public.teams where event_id=p_event and number=p_payload->>'team') then raise exception 'Choose a valid team'; end if;
 if p_kind='attendance' and (p_session is null or coalesce(p_payload->>'status','') not in('present','absent','unknown')) then raise exception 'Invalid attendance'; end if;
 if p_kind<>'attendance' and (coalesce(p_payload->>'status','') not in('open','closed') or jsonb_typeof(p_payload->'note')<>'string' or length(coalesce(p_payload->>'note','')) not between 1 and 3000 or length(coalesce(p_payload->>'owner',''))>100) then raise exception 'Invalid operation details'; end if;
 if p_division<0 or (p_division>0 and not exists(select 1 from public.event_settings s, jsonb_array_elements(s.value->'divisions') d where s.event_id=p_event and s.key='vex_divisions' and (d->>'id')::integer=p_division)) then raise exception 'Invalid division'; end if;
 if p_id is null then
  insert into public.event_operations(event_id,session_id,division_id,kind,payload,created_by) values(p_event,p_session,p_division,p_kind,p_payload,auth.uid()) returning * into row;
 else
  select * into row from public.event_operations where id=p_id and event_id=p_event for update;
  if row.id is null or row.kind<>p_kind or row.session_id is distinct from p_session or row.version<>p_version then raise exception 'Record changed. Reload before saving.'; end if;
  if row.division_id<>p_division and not public.has_event_role(p_event,array['admin']) then raise exception 'Admin required to move divisions'; end if;
  update public.event_operations set payload=p_payload,division_id=p_division,version=version+1,updated_at=now() where id=p_id returning * into row;
 end if;
 return row;
end;$$;
revoke all on public.event_operations from anon,authenticated;
grant select on public.event_operations to authenticated;
revoke all on function public.save_event_operation(uuid,uuid,integer,text,jsonb,uuid,integer) from public,anon;
grant execute on function public.save_event_operation(uuid,uuid,integer,text,jsonb,uuid,integer) to authenticated;
create or replace function public.validate_interview_planning() returns trigger language plpgsql set search_path=public as $$
declare item jsonb; other jsonb; buffer integer;
begin
 for item in select * from jsonb_array_elements(new.value->'entries') loop
  if coalesce(item->>'buffer','0') !~ '^[0-9]+$' then raise exception 'Invalid interview buffer'; end if;
  buffer=coalesce(item->>'buffer','0')::integer;if buffer not between 0 and 60 then raise exception 'Invalid interview buffer'; end if;
  if coalesce(item->>'status','scheduled') not in('scheduled','completed','missed','rescheduled') or length(coalesce(item->>'group',''))>100 then raise exception 'Invalid interview status or group'; end if;
  for other in select * from jsonb_array_elements(new.value->'entries') loop
   if item->>'id'<>other->>'id' and lower(trim(item->>'panel'))=lower(trim(other->>'panel')) and (item->>'start')::timestamptz < (other->>'start')::timestamptz+make_interval(mins=>coalesce(other->>'minutes','10')::integer+coalesce(other->>'buffer','0')::integer) and (other->>'start')::timestamptz < (item->>'start')::timestamptz+make_interval(mins=>(item->>'minutes')::integer+buffer) then raise exception 'Interview buffer overlaps another interview'; end if;
  end loop;
 end loop;
 return new;
end;$$;
drop trigger if exists interview_planning_guard on public.judging_interview_schedules;
create trigger interview_planning_guard before insert or update on public.judging_interview_schedules for each row execute function public.validate_interview_planning();
commit;
