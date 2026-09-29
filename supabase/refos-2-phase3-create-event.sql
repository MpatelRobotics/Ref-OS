-- Ref OS 2.0 Phase 3
-- Creates a new VEX event shell. Tournament Manager imports populate event data later.
-- Safe to rerun.
-- NOTE: refos-2-default-rules-template.sql redefines create_refos_vex_event so new events also
-- receive the default rule library. If you re-run this file, run that file again afterwards.

create extension if not exists pgcrypto;

create or replace function public.create_refos_vex_event(
  p_name text,
  p_admin_credential text
)
returns setof public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_event public.events%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_code text := upper(trim(coalesce(p_admin_credential, '')));
begin
  if v_user is null then
    raise exception 'You must have an active Ref OS session.';
  end if;

  if length(v_name) < 3 then
    raise exception 'Event name must be at least 3 characters.';
  end if;

  if v_code !~ '^[0-9][A-Z][0-9][0-9]$' then
    raise exception 'Admin access code must use the Ref OS 4 character format.';
  end if;

  insert into public.events(
    name, quals, practice, bracket, finals_best_of, join_code, created_by
  )
  values (
    v_name,
    0,
    0,
    0,
    1,
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    v_user
  )
  returning * into v_event;

  insert into public.event_members(event_id, user_id, role)
  values (v_event.id, v_user, 'admin')
  on conflict (event_id, user_id)
  do update set role = 'admin';

  insert into public.event_access_credentials(
    event_id, credential_name, role, credential_hash, enabled
  )
  values (
    v_event.id,
    'admin_keypad',
    'admin',
    encode(extensions.digest(v_code, 'sha256'::text), 'hex'),
    true
  )
  on conflict (event_id, credential_name)
  do update set
    role = excluded.role,
    credential_hash = excluded.credential_hash,
    enabled = true,
    updated_at = now();

  return next v_event;
end;
$$;

revoke all on function public.create_refos_vex_event(text, text) from public, anon;
grant execute on function public.create_refos_vex_event(text, text) to authenticated;
