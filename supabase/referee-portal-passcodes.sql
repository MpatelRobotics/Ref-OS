-- Run after referee-portal.sql, event lifecycle and Developer access migrations.
create table if not exists public.referee_external_events (
 user_id uuid not null references auth.users(id) on delete cascade,
 code text not null check(code ~ '^(RE|VE)-[A-Z0-9-]+$'),
 name text not null check(length(name) between 1 and 250),
 location text not null default '' check(length(location)<=500),
 start_date text not null default '' check(length(start_date)<=40),
 attendance text not null check(attendance in ('attended','going')),
 primary key(user_id,code)
);
alter table public.referee_external_events enable row level security;
revoke all on public.referee_external_events from anon,authenticated;
grant select,insert,update,delete on public.referee_external_events to authenticated;
drop policy if exists referee_external_owner on public.referee_external_events;
create policy referee_external_owner on public.referee_external_events for all to authenticated
 using(user_id=auth.uid() and coalesce(auth.jwt()->>'is_anonymous','true')='false')
 with check(user_id=auth.uid() and coalesce(auth.jwt()->>'is_anonymous','true')='false');

create table if not exists public.referee_passcodes (
 user_id uuid primary key references auth.users(id) on delete cascade,
 code_digest text not null unique,
 code_hash text not null
);
alter table public.referee_passcodes enable row level security;
revoke all on public.referee_passcodes from public,anon,authenticated;

create or replace function public.set_referee_passcode(p_code text)
returns void language plpgsql security definer set search_path=public as $$
declare v_code text:=upper(trim(coalesce(p_code,'')));
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','true')<>'false' then raise exception 'Sign in to your referee account first'; end if;
 if v_code='' then delete from public.referee_passcodes where user_id=auth.uid();return;end if;
 if v_code !~ '^[A-Z0-9]{8,16}$' or v_code !~ '[A-Z]' or v_code !~ '[0-9]' then raise exception 'Use 8–16 letters and numbers, including at least one of each';end if;
 begin
 insert into public.referee_passcodes values(auth.uid(),encode(extensions.digest(v_code,'sha256'),'hex'),extensions.crypt(v_code,extensions.gen_salt('bf',10)))
 on conflict(user_id) do update set code_digest=excluded.code_digest,code_hash=excluded.code_hash;
 exception when unique_violation then raise exception 'That passcode is unavailable. Choose another.';end;
end;$$;
create or replace function public.has_referee_passcode()
returns boolean language sql security definer set search_path=public as $$
 select exists(select 1 from public.referee_passcodes where user_id=auth.uid());
$$;

-- Only public event identity/location is exposed; no access codes or operational settings.
create or replace function public.list_referee_event_catalog()
returns table(event_id uuid,code text,location text) language sql stable security definer set search_path=public as $$
 select e.id,upper(left(coalesce(s.value->>'code',''),80)),left(coalesce(s.value->>'location',''),500)
 from public.events e left join public.event_settings s on s.event_id=e.id and s.key='vex_event';
$$;

-- Personal passcodes grant Referee access only for the owner's selected events.
-- Null code is allowed only for the signed-in account opening its own portal event.
create or replace function public.claim_referee_passcode(p_event uuid,p_code text default null)
returns text language plpgsql security definer set search_path=public as $$
declare v_owner uuid;v_code text:=upper(trim(coalesce(p_code,'')));v_hash text;
 v_event_code text;v_attempt public.event_access_attempts%rowtype;v_failed int;v_role text;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if not exists(select 1 from public.events where id=p_event and archived_at is null) then return 'archived';end if;
 -- Serialize attempts for this device/event so concurrent failures cannot bypass lockout.
 perform pg_advisory_xact_lock(hashtext(p_event::text),hashtext(auth.uid()::text));
 select * into v_attempt from public.event_access_attempts where event_id=p_event and user_id=auth.uid();
 if v_attempt.locked_until>now() then return 'locked';end if;
 if p_code is null and coalesce(auth.jwt()->>'is_anonymous','true')='false' then v_owner:=auth.uid();
 elsif v_code ~ '^[A-Z0-9]{8,16}$' then
  select user_id,code_hash into v_owner,v_hash from public.referee_passcodes where code_digest=encode(extensions.digest(v_code,'sha256'),'hex');
  if v_owner is not null and extensions.crypt(v_code,v_hash)<>v_hash then v_owner:=null;end if;
  if coalesce(auth.jwt()->>'is_anonymous','true')='false' and v_owner<>auth.uid() then v_owner:=null;end if;
 end if;
 select upper(s.value->>'code') into v_event_code from public.event_settings s where s.event_id=p_event and s.key='vex_event';
 if v_owner is not null and (exists(select 1 from public.referee_event_plans where user_id=v_owner and event_id=p_event)
 or exists(select 1 from public.referee_external_events where user_id=v_owner and code=v_event_code)) then
  v_role:='ref';
  if v_owner=auth.uid() then select coalesce((select role from public.event_members where event_id=p_event and user_id=auth.uid()),'ref') into v_role;end if;
  insert into public.event_members(event_id,user_id,role,name) values(p_event,auth.uid(),v_role,coalesce((select full_name from public.referee_profiles where user_id=v_owner),'Referee'))
  on conflict(event_id,user_id) do update set role=excluded.role,name=excluded.name;
  delete from public.event_access_attempts where event_id=p_event and user_id=auth.uid();
  return 'ok';
 end if;
 if v_attempt.user_id is null or v_attempt.window_started<now()-interval '5 minutes' then v_failed:=1;
 else v_failed:=v_attempt.failed_count+1;end if;
 insert into public.event_access_attempts(event_id,user_id,failed_count,window_started,locked_until)
 values(p_event,auth.uid(),v_failed,case when v_failed=1 then now() else v_attempt.window_started end,case when v_failed>=8 then now()+interval '5 minutes' else null end)
 on conflict(event_id,user_id) do update set failed_count=excluded.failed_count,window_started=excluded.window_started,locked_until=excluded.locked_until;
 return case when v_failed>=8 then 'locked' else 'invalid' end;
end;$$;
revoke all on function public.set_referee_passcode(text),public.has_referee_passcode(),public.claim_referee_passcode(uuid,text),public.list_referee_event_catalog() from public,anon;
grant execute on function public.set_referee_passcode(text),public.has_referee_passcode(),public.claim_referee_passcode(uuid,text),public.list_referee_event_catalog() to authenticated;

-- A selected VEX event may be opened before anyone has set an event Admin code.
-- Reuses a workspace by exact VEX code; creates a new workspace only when absent.
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
   (v_event,'competition_program',jsonb_build_object('program',case when v_code ~ '(IQ|VIQ)' then 'iq' else 'v5' end));
 end if;
 insert into public.referee_event_plans values(auth.uid(),v_event,v_plan.attendance)
 on conflict(user_id,event_id) do update set attendance=excluded.attendance;
 v_outcome:=public.claim_referee_passcode(v_event,null);
 if v_outcome<>'ok' then raise exception 'Cannot open this event: %',v_outcome;end if;
 return v_event;
end;$$;
revoke all on function public.open_referee_external_event(text) from public,anon;
grant execute on function public.open_referee_external_event(text) to authenticated;
