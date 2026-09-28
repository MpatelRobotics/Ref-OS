-- Ref OS 2.0 Phase 3 credential claim fix
-- Recreates claim_event_access with pgcrypto explicitly schema-qualified.
-- Supports access codes whose second character is any A-Z letter.

create extension if not exists pgcrypto;

create or replace function public.claim_event_access(
  p_event uuid,
  p_credential text
)
returns table(role text, is_admin boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_code text := upper(trim(coalesce(p_credential, '')));
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if v_code !~ '^[0-9][A-Z][0-9][0-9]$' then
    raise exception 'Invalid event credential';
  end if;

  select c.role
    into v_role
    from public.event_access_credentials c
   where c.event_id = p_event
     and c.enabled = true
     and c.credential_hash = encode(extensions.digest(v_code, 'sha256'::text), 'hex')
   limit 1;

  if v_role is null then
    raise exception 'Invalid event credential';
  end if;

  insert into public.event_members(event_id, user_id, role)
  values (p_event, v_user, v_role)
  on conflict (event_id, user_id)
  do update set role = excluded.role;

  return query
  select v_role, (v_role = 'admin');
end;
$$;

revoke all on function public.claim_event_access(uuid, text) from public, anon;
grant execute on function public.claim_event_access(uuid, text) to authenticated;
