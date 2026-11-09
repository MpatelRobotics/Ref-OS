begin;
create or replace function public.require_judging_preview(p_event uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.event_members m join public.events e on e.id=m.event_id
 where m.event_id=p_event and m.user_id=auth.uid() and m.role='admin' and e.archived_at is null)
 then raise exception 'Event admin access required for judging setup' using errcode='42501'; end if;
end;$$;
revoke all on function public.require_judging_preview(uuid) from public,anon;
grant execute on function public.require_judging_preview(uuid) to authenticated;


commit;
