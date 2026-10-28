-- Run after the event discovery, branding, league and developer access migrations.
-- Safe to rerun. Keep this migration last if reinstalling public discovery functions.
begin;
create table if not exists public.developer_test_events (
 event_id uuid primary key references public.events(id) on delete cascade,
 created_by uuid not null,
 created_at timestamptz not null default now()
);
alter table public.developer_test_events enable row level security;
revoke all on public.developer_test_events from public,anon,authenticated;

create or replace function public.refos_is_developer(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.event_members where user_id=p_user and role='admin' and developer=true);
$$;
revoke all on function public.refos_is_developer(uuid) from public,anon;
grant execute on function public.refos_is_developer(uuid) to authenticated;

create or replace function public.refos_test_event_allowed(p_event uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select not exists(select 1 from public.developer_test_events where event_id=p_event)
     or public.refos_is_developer(auth.uid());
$$;
revoke all on function public.refos_test_event_allowed(uuid) from public;
grant execute on function public.refos_test_event_allowed(uuid) to anon,authenticated;

-- SECURITY DEFINER discovery RPCs bypass RLS. Wrap each existing return shape unchanged,
-- and revoke access to the unfiltered implementation so it cannot be called directly.
do $$
declare name text; base text; result_type text;
begin
 foreach name in array array['list_refos_events','list_refos_event_branding','list_refos_event_lifecycle','list_refos_event_formats','list_refos_event_locations'] loop
  base:=name||'_public_base';
  if to_regprocedure('public.'||base||'()') is null then
   if to_regprocedure('public.'||name||'()') is null then continue; end if;
   execute format('alter function public.%I() rename to %I',name,base);
  end if;
  select pg_get_function_result(to_regprocedure('public.'||base||'()')) into result_type;
  execute format('create or replace function public.%I() returns %s language sql stable security definer set search_path=public as %L',name,result_type,
   format('select row.* from public.%I() row where not exists(select 1 from public.developer_test_events t where t.event_id=row.event_id)',base));
  execute format('revoke all on function public.%I() from public,anon,authenticated',base);
  execute format('revoke all on function public.%I() from public',name);
  execute format('grant execute on function public.%I() to anon,authenticated',name);
 end loop;
end $$;

-- Restrictive guards compose with the existing role policies. They do not grant access.
do $$
declare t record; key_name text;
begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and c.relrowsecurity
   and (c.relname='events' or exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='event_id' and a.atttypid='uuid'::regtype and not a.attisdropped)) loop
  key_name:=case when t.relname='events' then 'id' else 'event_id' end;
  execute format('drop policy if exists refos_private_test_guard on public.%I',t.relname);
  execute format('create policy refos_private_test_guard on public.%I as restrictive for all to anon,authenticated using (public.refos_test_event_allowed(%I)) with check (public.refos_test_event_allowed(%I))',t.relname,key_name,key_name);
 end loop;
end $$;

create or replace function public.guard_developer_test_membership()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.developer_test_events where event_id=new.event_id)
    and not (new.role='admin' and coalesce(new.developer,false))
    and not public.refos_is_developer(new.user_id) then
  raise exception 'This test event is available only to developers.';
 end if;
 return new;
end $$;
revoke all on function public.guard_developer_test_membership() from public,anon,authenticated;
drop trigger if exists guard_developer_test_membership on public.event_members;
create trigger guard_developer_test_membership before insert or update on public.event_members for each row execute function public.guard_developer_test_membership();

-- Remove the old passcode-taking entry point and any credentials on existing test events.
create or replace function public.seed_developer_test_matches(p_event uuid)
returns int language plpgsql security definer set search_path=public as $$
declare v_event public.events%rowtype; v_session uuid; roster text[]; round_num int; slot int; match_num int;
begin
 if not public.refos_is_developer(auth.uid()) then raise exception 'Developer access required.'; end if;
 select e.* into v_event from public.events e join public.developer_test_events t on t.event_id=e.id where e.id=p_event for update of e;
 if not found then raise exception 'Private test event not found.'; end if;
 if v_event.archived_at is not null then raise exception 'Restore this test event first.'; end if;
 if exists(select 1 from public.matches where event_id=p_event) then return 0; end if;
 if (select count(*) from public.teams where event_id=p_event)<>32 or
    (select count(*) from public.teams where event_id=p_event and number in(select (97000+i)::text||chr(65+(i-1)%26) from generate_series(1,32)i))<>32 then
  raise exception 'This schedule needs the original 32 fictional test teams.';
 end if;
 if v_event.event_format='league' then
  select id into v_session from public.league_sessions where event_id=p_event and status='active' limit 1;
  if v_session is null then
   if exists(select 1 from public.league_sessions where event_id=p_event) then raise exception 'Start a league session before adding the fictional schedule.'; end if;
   insert into public.league_sessions(event_id,name,status,started_at) values(p_event,'Test Session 1','active',now()) returning id into v_session;
  end if;
 end if;
 for round_num in 0..5 loop
  select array_agg(number order by md5(round_num::text||':'||number)) into roster from public.teams where event_id=p_event;
  for slot in 0..7 loop
   match_num:=round_num*8+slot+1;
   insert into public.matches(event_id,session_id,phase,num,label,red,blue,field)
   values(p_event,v_session,'qual',match_num,'Q'||match_num,array[roster[slot*4+1],roster[slot*4+2]],array[roster[slot*4+3],roster[slot*4+4]],
     'Field '||case when v_event.event_format='league' then 1 else 1+(match_num-1)%2 end);
  end loop;
 end loop;
 update public.events set quals=48 where id=p_event;
 return 48;
end $$;
revoke all on function public.seed_developer_test_matches(uuid) from public,anon;
grant execute on function public.seed_developer_test_matches(uuid) to authenticated;

drop function if exists public.create_developer_test_event(text,text,text,boolean);
delete from public.event_access_credentials where event_id in (select event_id from public.developer_test_events);
create or replace function public.create_developer_test_event(p_name text,p_format text default 'tournament',p_sample_teams boolean default true)
returns setof public.events language plpgsql security definer set search_path=public as $$
declare v_event public.events%rowtype; factory_code text;
begin
 if not public.refos_is_developer(auth.uid()) then raise exception 'Developer access required.'; end if;
 if p_format not in ('tournament','league') then raise exception 'Choose Tournament or League.'; end if;
 -- Reuse normal event/rule setup atomically. Its temporary credential is removed before
 -- this transaction commits; private events have no usable event access code.
 factory_code:=floor(random()*10)::int::text||chr(65+floor(random()*26)::int)||lpad(floor(random()*100)::int::text,2,'0');
 select * into v_event from public.create_refos_vex_event_with_format(trim(p_name),factory_code,p_format) limit 1;
 if v_event.id is null then raise exception 'Could not create test event.'; end if;
 update public.event_members set developer=true where event_id=v_event.id and user_id=auth.uid();
 insert into public.developer_test_events(event_id,created_by) values(v_event.id,auth.uid());
 delete from public.event_access_credentials where event_id=v_event.id;
 if p_sample_teams then
  insert into public.teams(event_id,number,name)
  select v_event.id,(97000+i)::text||chr(65+(i-1)%26),'Test Team '||lpad(i::text,2,'0') from generate_series(1,32) i;
  perform public.seed_developer_test_matches(v_event.id);
  select * into v_event from public.events where id=v_event.id;
 end if;
 return next v_event;
end $$;
revoke all on function public.create_developer_test_event(text,text,boolean) from public,anon;
grant execute on function public.create_developer_test_event(text,text,boolean) to authenticated;

create or replace function public.list_developer_test_events()
returns setof public.events language plpgsql stable security definer set search_path=public as $$
begin
 if not public.refos_is_developer(auth.uid()) then raise exception 'Developer access required.'; end if;
 return query select e.* from public.events e join public.developer_test_events t on t.event_id=e.id order by e.created_at desc;
end $$;
revoke all on function public.list_developer_test_events() from public,anon;
grant execute on function public.list_developer_test_events() to authenticated;

create or replace function public.open_developer_test_event(p_event uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.refos_is_developer(auth.uid()) then raise exception 'Developer access required.'; end if;
 if not exists(select 1 from public.developer_test_events where event_id=p_event) then raise exception 'Test event not found.'; end if;
 insert into public.event_members(event_id,user_id,role,developer) values(p_event,auth.uid(),'admin',true)
 on conflict(event_id,user_id) do update set role='admin',developer=true;
end $$;
revoke all on function public.open_developer_test_event(uuid) from public,anon;
grant execute on function public.open_developer_test_event(uuid) to authenticated;

-- A verified developer session can open normal events without creating a volunteer profile.
create or replace function public.open_developer_event(p_event uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.refos_is_developer(auth.uid()) then raise exception 'Developer access required.'; end if;
 if not exists(select 1 from public.events where id=p_event) then raise exception 'Event not found.'; end if;
 insert into public.event_members(event_id,user_id,role,developer) values(p_event,auth.uid(),'admin',true)
 on conflict(event_id,user_id) do update set role='admin',developer=true;
end $$;
revoke all on function public.open_developer_event(uuid) from public,anon;
grant execute on function public.open_developer_event(uuid) to authenticated;

create or replace function public.delete_developer_test_event(p_event uuid,p_confirm_name text)
returns void language plpgsql security definer set search_path=public as $$
declare v_event public.events%rowtype; v_table text;
 v_known text[]:=array['push_dispatches','push_subscriptions','device_status','feedback','awp_status','field_reset_status','field_reset_checks','field_log','violations','nominations','shortlist','watch_notes','alliances','matches','teams','rules','ref_roster','event_settings','event_access_attempts','event_access_credentials','event_members'];
begin
 if not public.refos_is_developer(auth.uid()) then raise exception 'Developer access required.'; end if;
 select e.* into v_event from public.events e join public.developer_test_events t on t.event_id=e.id where e.id=p_event for update of e;
 if not found then raise exception 'Private test event not found.'; end if;
 if v_event.name is distinct from p_confirm_name then raise exception 'The event name changed. Refresh and try again.'; end if;
 -- Reuse normal archive/protection checks, but developer authorization replaces a passcode.
 perform public.open_developer_test_event(p_event);
 perform public.archive_refos_event(p_event);
 foreach v_table in array v_known loop
  if to_regclass('public.'||v_table) is not null then execute format('delete from public.%I where event_id=$1',v_table) using p_event; end if;
 end loop;
 for v_table in select c.table_name from information_schema.columns c join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name
  where c.table_schema='public' and c.column_name='event_id' and c.data_type='uuid' and t.table_type='BASE TABLE' and c.table_name<>all(v_known)
 loop execute format('delete from public.%I where event_id=$1',v_table) using p_event; end loop;
 insert into public.refos_storage_purge_queue(purged_event_id) values(p_event) on conflict(purged_event_id) do update set requested_at=now();
 delete from public.events where id=p_event;
end $$;
revoke all on function public.delete_developer_test_event(uuid,text) from public,anon;
grant execute on function public.delete_developer_test_event(uuid,text) to authenticated;
commit;
