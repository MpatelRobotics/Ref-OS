-- Run after event lifecycle and Developer access migrations.
-- Only the trusted Edge Function may call this after verifying the Developer secret.
create or replace function public.restore_refos_event_as_developer(p_event uuid, p_user uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_archived timestamptz;
begin
 if p_user is null then raise exception 'Authentication required'; end if;
 select archived_at into v_archived from public.events where id=p_event for update;
 if not found then raise exception 'Event not found'; end if;
 if public.refos_access_locked(p_event,p_user) then return 'locked'; end if;
 if v_archived is null then return 'active'; end if;
 perform set_config('refos.lifecycle_change','on',true);
 update public.events set archived_at=null where id=p_event;
 delete from public.event_access_attempts where event_id=p_event and user_id=p_user;
 return 'restored';
end;
$$;
revoke all on function public.restore_refos_event_as_developer(uuid,uuid) from public,anon,authenticated;
grant execute on function public.restore_refos_event_as_developer(uuid,uuid) to service_role;
