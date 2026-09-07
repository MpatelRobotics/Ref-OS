-- Ref OS login code digest fix
-- Run this once in the Supabase SQL Editor.
-- Supabase commonly installs pgcrypto in the extensions schema.
-- The previous claim_event_access function restricted its search path to public,
-- which made digest() unavailable and caused: function digest(text, unknown) does not exist.

create extension if not exists pgcrypto;

create or replace function public.claim_event_access(p_event uuid, p_credential text)
returns table(role text, is_admin boolean)
language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_role text;
  v_hash text;
  v_attempt public.event_access_attempts%rowtype;
  v_failed int;
begin
  if auth.uid() is null then
    raise exception 'Authentication session required';
  end if;

  select * into v_attempt
  from public.event_access_attempts
  where event_id=p_event and user_id=auth.uid();

  if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    raise exception 'Too many login attempts. Try again in a few minutes.';
  end if;

  v_hash := encode(digest(coalesce(p_credential,''), 'sha256'), 'hex');

  select c.role into v_role
  from public.event_access_credentials c
  where c.event_id = p_event
    and c.enabled = true
    and c.credential_hash = v_hash
  order by case when c.role = 'admin' then 0 else 1 end
  limit 1;

  if v_role is null then
    if v_attempt.user_id is null or v_attempt.window_started < now() - interval '5 minutes' then
      v_failed := 1;
      insert into public.event_access_attempts(event_id,user_id,failed_count,window_started,locked_until)
      values(p_event,auth.uid(),1,now(),null)
      on conflict(event_id,user_id)
      do update set failed_count=1,window_started=now(),locked_until=null;
    else
      v_failed := v_attempt.failed_count + 1;
      update public.event_access_attempts
      set failed_count=v_failed,
          locked_until=case when v_failed >= 8 then now() + interval '5 minutes' else null end
      where event_id=p_event and user_id=auth.uid();
    end if;

    if v_failed >= 8 then
      raise exception 'Too many login attempts. Try again in a few minutes.';
    end if;
    raise exception 'Invalid event credential';
  end if;

  delete from public.event_access_attempts
  where event_id=p_event and user_id=auth.uid();

  insert into public.event_members(event_id, user_id, role)
  values (p_event, auth.uid(), v_role)
  on conflict (event_id, user_id)
  do update set role = excluded.role;

  return query select v_role, (v_role = 'admin');
end;
$$;

grant execute on function public.claim_event_access(uuid,text) to authenticated;
