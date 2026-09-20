create or replace function public.reset_volunteer_sign_ins(p_event uuid)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_version bigint;
begin
  if not public.has_event_role(p_event, array['admin']) then
    raise exception 'Admin role required';
  end if;

  v_version := (extract(epoch from clock_timestamp()) * 1000)::bigint;

  insert into public.event_settings (event_id, key, value, updated_by, updated_at)
  values (p_event, 'identity_reset', jsonb_build_object('version', v_version), 'Admin', now())
  on conflict (event_id, key) do update
    set value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  delete from public.field_log where event_id = p_event and kind = 'volunteer_contact';
  delete from public.event_settings where event_id = p_event and key = 'volunteer_assignments';
  delete from public.ref_roster where event_id = p_event;
  delete from public.event_members where event_id = p_event;

  return v_version;
end;
$$;

revoke all on function public.reset_volunteer_sign_ins(uuid) from public, anon;
grant execute on function public.reset_volunteer_sign_ins(uuid) to authenticated;
