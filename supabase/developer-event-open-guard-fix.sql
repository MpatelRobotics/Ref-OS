begin;
-- Use the trusted claim path so the membership trigger preserves the verified
-- developer flag. A plain INSERT/UPDATE deliberately strips newly assigned flags.
create or replace function public.open_developer_event(p_event uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.refos_is_developer(auth.uid()) then raise exception 'Developer access required.' using errcode='42501';end if;
 if not exists(select 1 from public.events where id=p_event) then raise exception 'Event not found.';end if;
 perform public.claim_developer_event_access(p_event,auth.uid());
end;$$;
revoke all on function public.open_developer_event(uuid) from public,anon;
grant execute on function public.open_developer_event(uuid) to authenticated;
commit;
