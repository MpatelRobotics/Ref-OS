-- Update event deletion authorization only. Requires the Phase 7 event management schema.
-- Keeps existing role checks, protection, exact-name confirmation and rate limits.
begin;

create or replace function public.delete_archived_refos_event(
  p_event uuid,
  p_confirm_name text,
  p_admin_credential text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_admin_credential, '')));
  v_event public.events%rowtype;
  v_attempt public.event_access_attempts%rowtype;
  v_failed int;
  v_ok boolean := false;
  v_table text;
  v_known text[] := array[
    'push_dispatches', 'push_subscriptions', 'device_status', 'feedback', 'awp_status',
    'field_reset_status', 'field_reset_checks', 'field_log', 'violations', 'nominations',
    'shortlist', 'watch_notes', 'alliances', 'matches', 'teams', 'rules', 'ref_roster',
    'event_settings', 'event_access_attempts', 'event_access_credentials', 'event_members'
  ];
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;

  if p_event = '11111111-1111-4111-8111-111111111111'::uuid
     or coalesce((
       select (s.value->>'protected')::boolean
       from public.event_settings s
       where s.event_id = p_event and s.key = 'system_protection'
     ), false) then
    raise exception 'This is a protected event and cannot be deleted' using errcode = 'P0001';
  end if;

  select * into v_event from public.events e where e.id = p_event for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0001';
  end if;
  if v_event.archived_at is null then
    raise exception 'Archive this event before deleting it permanently' using errcode = 'P0001';
  end if;

  select * into v_attempt
    from public.event_access_attempts a
   where a.event_id = p_event and a.user_id = v_user;
  if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    return 'locked';
  end if;

  if trim(coalesce(p_confirm_name, '')) is distinct from trim(coalesce(v_event.name, '')) then
    return 'name_mismatch';
  end if;

  -- Authorization: this event's Admin access code, OR the Ref OS emergency deletion override.
  -- The override is stored only as a SHA-256 hash, exists only inside this function, and is
  -- checked only after the protected-event, archived-event, lockout, and exact-name checks above.
  -- It is not an event access credential: it cannot sign in, grant any role, unlock Event
  -- Settings or Event Management, restore an event, or delete an active or protected event.
  if v_code ~ '^[0-9][A-Z][0-9][0-9]$' then
    v_ok := exists (
      select 1
        from public.event_access_credentials c
       where c.event_id = p_event
         and c.role = 'admin'
         and c.enabled = true
         and c.credential_hash = encode(extensions.digest(v_code, 'sha256'::text), 'hex')
    )
    or encode(extensions.digest(v_code, 'sha256'::text), 'hex')
       = '6f2c53c4ccadf9cf527bfb28012762f525820091bbc3f54b3a8e3be752069406';
  end if;

  -- A wrong Admin/override code counts toward the same lockout as restore and login attempts.
  if not v_ok then
    if v_attempt.user_id is null or v_attempt.window_started < now() - interval '5 minutes' then
      v_failed := 1;
      insert into public.event_access_attempts(event_id, user_id, failed_count, window_started, locked_until)
      values (p_event, v_user, 1, now(), null)
      on conflict (event_id, user_id)
      do update set failed_count = 1, window_started = now(), locked_until = null;
    else
      v_failed := v_attempt.failed_count + 1;
      update public.event_access_attempts
         set failed_count = v_failed,
             locked_until = case when v_failed >= 8 then now() + interval '5 minutes' else null end
       where event_id = p_event and user_id = v_user;
    end if;
    return case when v_failed >= 8 then 'locked' else 'invalid' end;
  end if;

  -- Known event-scoped tables, children first.
  foreach v_table in array v_known loop
    if to_regclass('public.' || v_table) is not null then
      execute format('delete from public.%I where event_id = $1', v_table) using p_event;
    end if;
  end loop;

  -- Any other public table that stores an event_id (for example, one added after Phase 7).
  for v_table in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public'
       and c.column_name = 'event_id'
       and c.data_type = 'uuid'
       and t.table_type = 'BASE TABLE'
       and c.table_name <> all (v_known)
  loop
    execute format('delete from public.%I where event_id = $1', v_table) using p_event;
  end loop;

  -- Queue this event's cloud photos for server-side removal (rolled back if the delete fails).
  insert into public.refos_storage_purge_queue(purged_event_id)
  values (p_event)
  on conflict (purged_event_id) do update set requested_at = now();

  delete from public.events where id = p_event;
  return 'deleted';
end;
$$;

revoke all on function public.delete_archived_refos_event(uuid, text, text) from public, anon;
grant execute on function public.delete_archived_refos_event(uuid, text, text) to authenticated;

create or replace function public.emergency_delete_refos_event(
  p_event uuid,
  p_confirm_name text,
  p_override_code text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_override_code, '')));
  v_event public.events%rowtype;
  v_attempt public.event_access_attempts%rowtype;
  v_failed int;
  v_result text;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;

  if p_event = '11111111-1111-4111-8111-111111111111'::uuid
     or coalesce((
       select (s.value->>'protected')::boolean
       from public.event_settings s
       where s.event_id = p_event and s.key = 'system_protection'
     ), false) then
    raise exception 'This is a protected event and cannot be deleted' using errcode = 'P0001';
  end if;

  select * into v_event from public.events e where e.id = p_event for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0001';
  end if;

  select * into v_attempt
    from public.event_access_attempts a
   where a.event_id = p_event and a.user_id = v_user;
  if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    return 'locked';
  end if;

  if trim(coalesce(p_confirm_name, '')) is distinct from trim(coalesce(v_event.name, '')) then
    return 'name_mismatch';
  end if;

  -- Override only. Same hash as the permanent-delete override; no event access code is accepted.
  if v_code !~ '^[0-9][A-Z][0-9][0-9]$'
     or encode(extensions.digest(v_code, 'sha256'::text), 'hex')
        <> '6f2c53c4ccadf9cf527bfb28012762f525820091bbc3f54b3a8e3be752069406' then
    if v_attempt.user_id is null or v_attempt.window_started < now() - interval '5 minutes' then
      v_failed := 1;
      insert into public.event_access_attempts(event_id, user_id, failed_count, window_started, locked_until)
      values (p_event, v_user, 1, now(), null)
      on conflict (event_id, user_id)
      do update set failed_count = 1, window_started = now(), locked_until = null;
    else
      v_failed := v_attempt.failed_count + 1;
      update public.event_access_attempts
         set failed_count = v_failed,
             locked_until = case when v_failed >= 8 then now() + interval '5 minutes' else null end
       where event_id = p_event and user_id = v_user;
    end if;
    return case when v_failed >= 8 then 'locked' else 'invalid' end;
  end if;

  -- Step 1: archive (only if still active), through the same lifecycle guard as Event Management.
  if v_event.archived_at is null then
    perform set_config('refos.lifecycle_change', 'on', true);
    update public.events set archived_at = now() where id = p_event;
  end if;

  -- Step 2 and 3: the existing permanent delete removes all event-scoped data and the event.
  v_result := public.delete_archived_refos_event(p_event, p_confirm_name, v_code);
  if v_result is distinct from 'deleted' then
    -- Undo the archive above; nothing is left changed.
    raise exception 'Emergency deletion did not complete (%)', v_result using errcode = 'P0001';
  end if;
  return 'deleted';
end;
$$;

revoke all on function public.emergency_delete_refos_event(uuid, text, text) from public, anon;
grant execute on function public.emergency_delete_refos_event(uuid, text, text) to authenticated;

commit;
