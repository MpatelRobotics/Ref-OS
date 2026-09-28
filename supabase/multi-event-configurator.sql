-- Install once before deploying the multi event interface.
-- A new event gets its own admin membership and credential in one transaction.
create or replace function public.create_configured_event(
  p_name text, p_quals int, p_practice int, p_bracket int, p_finals int, p_admin_credential text, p_builder_code text
) returns public.events language plpgsql security definer
set search_path = public, extensions as $$
declare
  ev public.events;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Sign in before creating an event'; end if;
  if encode(digest(coalesce(p_builder_code, ''), 'sha256'), 'hex') <> encode(digest('4A23', 'sha256'), 'hex') then
    raise exception 'Invalid configurator credential';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 3 and 100 then raise exception 'Enter an event name between 3 and 100 characters'; end if;
  if p_quals not between 0 and 1000 or p_practice not between 0 and 1000
     or p_bracket not in (0,4,8,16) or p_finals not in (1,3) then
    raise exception 'Invalid event format';
  end if;
  if length(coalesce(p_admin_credential, '')) < 4 then raise exception 'Admin password must have at least 4 characters'; end if;
  if (select count(*) from public.events where created_by = auth.uid()) >= 5 then
    raise exception 'This account has reached the event creation limit';
  end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.events(name, quals, practice, bracket, finals_best_of, join_code, created_by)
    values (trim(p_name), p_quals, p_practice, p_bracket, p_finals, v_code, auth.uid()) returning * into ev;
  insert into public.event_members(event_id, user_id, role) values (ev.id, auth.uid(), 'admin');
  insert into public.event_access_credentials(event_id, credential_name, role, credential_hash, enabled)
    values (ev.id, 'organizer_admin', 'admin', encode(digest(p_admin_credential, 'sha256'), 'hex'), true);
  return ev;
end;
$$;
revoke all on function public.create_configured_event(text,int,int,int,int,text,text) from public, anon;
grant execute on function public.create_configured_event(text,int,int,int,int,text,text) to authenticated;

create or replace function public.verify_event_configurator(p_builder_code text)
returns boolean language sql security definer
set search_path = public, extensions as $$
  select auth.uid() is not null and
    encode(digest(coalesce(p_builder_code, ''), 'sha256'), 'hex') = encode(digest('4A23', 'sha256'), 'hex');
$$;
revoke all on function public.verify_event_configurator(text) from public, anon;
grant execute on function public.verify_event_configurator(text) to authenticated;

-- Ref OS 1.0 external-event readiness additions.
-- Highlander is explicitly marked as a protected legacy event for configurator clients.
insert into public.event_settings(event_id, key, value, updated_by)
values (
  '11111111-1111-4111-8111-111111111111'::uuid,
  'system_protection',
  '{"protected":true,"scope":"configurator","reason":"Highlander Summit legacy production event"}'::jsonb,
  'system'
)
on conflict (event_id, key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();

create or replace function public.is_configurator_protected_event(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_event = '11111111-1111-4111-8111-111111111111'::uuid
      or coalesce((select (value->>'protected')::boolean from public.event_settings where event_id=p_event and key='system_protection'), false);
$$;
revoke all on function public.is_configurator_protected_event(uuid) from public, anon;
grant execute on function public.is_configurator_protected_event(uuid) to authenticated;

-- Allow the Inspection role to receive an event-specific access code.
-- Older Ref OS installs limited this RPC to ref/judge/emcee/admin even though
-- event_members and event_access_credentials already support inspection.
create or replace function public.set_event_access_credential(
  p_event uuid, p_name text, p_role text, p_hash text, p_enabled boolean default true
)
returns void language plpgsql security definer set search_path=public, extensions as $$
begin
  if not public.has_event_role(p_event,array['admin']) then raise exception 'Admin role required'; end if;
  if p_role not in ('ref','judge','emcee','inspection','admin') then raise exception 'Invalid role'; end if;
  insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled,updated_at)
  values(p_event,p_name,p_role,p_hash,p_enabled,now())
  on conflict(event_id,credential_name)
  do update set role=excluded.role,credential_hash=excluded.credential_hash,enabled=excluded.enabled,updated_at=now();
end;
$$;


-- Delete an event created through the configurator.
-- Highlander is permanently protected. The creator must be the signed-in user
-- and must also provide the private configurator credential. Child event data
-- is removed by the existing ON DELETE CASCADE foreign keys.
create or replace function public.delete_configured_event(p_event uuid, p_builder_code text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'Sign in before deleting an event'; end if;
  if encode(digest(coalesce(p_builder_code, ''), 'sha256'), 'hex') <> encode(digest('4A23', 'sha256'), 'hex') then
    raise exception 'Invalid configurator credential';
  end if;
  if public.is_configurator_protected_event(p_event) then
    raise exception 'This event is protected and cannot be deleted';
  end if;
  if not exists (select 1 from public.events where id = p_event and created_by = auth.uid()) then
    raise exception 'Only the event creator can delete this event';
  end if;
  delete from public.events where id = p_event and created_by = auth.uid();
  return found;
end;
$$;
revoke all on function public.delete_configured_event(uuid,text) from public, anon;
grant execute on function public.delete_configured_event(uuid,text) to authenticated;
