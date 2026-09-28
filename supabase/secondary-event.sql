-- Ref OS secondary event support
-- Run this file once in the Supabase SQL Editor.
-- Highlander admins can create one active secondary VEX event.
-- Referee code: 2B23
-- Judge Advisor code: 2C23
-- The Highlander Admin credential hash is copied to the secondary event.

create or replace function public.create_highlander_secondary_event(
  p_name text
) returns public.events
language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_highlander constant uuid := '11111111-1111-4111-8111-111111111111'::uuid;
  ev public.events;
begin
  if auth.uid() is null then raise exception 'Sign in before creating an event'; end if;

  if not exists (
    select 1 from public.event_members
    where event_id = v_highlander and user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Highlander Admin access is required';
  end if;

  if length(trim(coalesce(p_name,''))) < 3 then raise exception 'Enter an event name'; end if;
  -- Only one secondary event is active at a time. Disable the fixed access
  -- codes on any older secondary event without deleting its historical data.
  update public.event_access_credentials
     set enabled = false, updated_at = now()
   where event_id <> v_highlander
     and credential_name in ('secondary_ref_code','secondary_judge_code');

  insert into public.events(name, quals, practice, bracket, finals_best_of, join_code, created_by)
  values (
    trim(p_name), 0, 0, 0, 1,
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)), auth.uid()
  ) returning * into ev;

  insert into public.event_members(event_id,user_id,role)
  values (ev.id,auth.uid(),'admin')
  on conflict (event_id,user_id) do update set role='admin';

  insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
  values
    (ev.id,'secondary_admin_code','admin',encode(digest('2A23','sha256'),'hex'),true),
    (ev.id,'secondary_ref_code','ref',encode(digest('2B23','sha256'),'hex'),true),
    (ev.id,'secondary_judge_code','judge',encode(digest('2C23','sha256'),'hex'),true)
  on conflict(event_id,credential_name)
  do update set role=excluded.role,credential_hash=excluded.credential_hash,enabled=true,updated_at=now();

  insert into public.event_settings(event_id,key,value,updated_by)
  values (ev.id,'secondary_event','{"active":true,"source":"Highlander Summit"}'::jsonb,'Highlander Admin')
  on conflict(event_id,key)
  do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=now();

  return ev;
end;
$$;

revoke all on function public.create_highlander_secondary_event(text) from public, anon;
grant execute on function public.create_highlander_secondary_event(text) to authenticated;


-- The OUT column names changed from the first version of this RPC.
-- PostgreSQL cannot change an existing function's TABLE return type with
-- CREATE OR REPLACE, so drop only this RPC before recreating it.
drop function if exists public.claim_active_secondary_event(text);

create or replace function public.claim_active_secondary_event(p_credential text)
returns table(target_event_id uuid, target_event_name text, target_role text, target_is_admin boolean)
language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_hash text := encode(digest(coalesce(p_credential,''),'sha256'),'hex');
  v_event uuid;
  v_name text;
  v_role text;
begin
  if auth.uid() is null then raise exception 'Sign in before claiming event access'; end if;

  select e.id,e.name,c.role
    into v_event,v_name,v_role
  from public.events e
  join public.event_access_credentials c on c.event_id=e.id
  where e.id <> '11111111-1111-4111-8111-111111111111'::uuid
    and c.credential_name in ('secondary_ref_code','secondary_judge_code')
    and c.enabled=true
    and c.credential_hash=v_hash
  order by e.created_at desc
  limit 1;

  if v_event is null then raise exception 'Invalid event credential'; end if;

  insert into public.event_members(event_id,user_id,role)
  values(v_event,auth.uid(),v_role)
  on conflict(event_id,user_id) do update set role=excluded.role;

  return query select v_event,v_name,v_role,false;
end;
$$;

revoke all on function public.claim_active_secondary_event(text) from public, anon;
grant execute on function public.claim_active_secondary_event(text) to authenticated;
