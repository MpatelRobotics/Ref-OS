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

create or replace function public.create_developer_test_event(p_name text,p_admin_credential text,p_format text default 'tournament',p_sample_teams boolean default true)
returns setof public.events language plpgsql security definer set search_path=public as $$
declare v_event public.events%rowtype;
begin
 if not public.refos_is_developer(auth.uid()) then raise exception 'Developer access required.'; end if;
 if p_format not in ('tournament','league') then raise exception 'Choose Tournament or League.'; end if;
 select * into v_event from public.create_refos_vex_event_with_format(trim(p_name),upper(trim(p_admin_credential)),p_format) limit 1;
 if v_event.id is null then raise exception 'Could not create test event.'; end if;
 update public.event_members set developer=true where event_id=v_event.id and user_id=auth.uid();
 insert into public.developer_test_events(event_id,created_by) values(v_event.id,auth.uid());
 if p_sample_teams then
  insert into public.teams(event_id,number,name)
  select v_event.id,(97000+i)::text||chr(65+(i-1)%26),'Test Team '||lpad(i::text,2,'0') from generate_series(1,32) i;
 end if;
 return next v_event;
end $$;
revoke all on function public.create_developer_test_event(text,text,text,boolean) from public,anon;
grant execute on function public.create_developer_test_event(text,text,text,boolean) to authenticated;

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
commit;
