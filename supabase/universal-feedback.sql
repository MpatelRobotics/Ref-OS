-- Run after feedback-management.sql. Verified Developer access grants cross-event feedback triage.
begin;
create or replace function public.list_universal_feedback()
returns table(id uuid,event_id uuid,event_name text,session_name text,note text,logged_by text,created_at timestamptz,status text)
language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.event_members where user_id=auth.uid() and role='admin' and developer=true) then
   raise exception 'Developer access required' using errcode='42501';
 end if;
 return query select f.id,f.event_id,e.name,coalesce(s.name,''),f.note,f.logged_by,f.created_at,coalesce(m.status,'new')
 from public.field_log f join public.events e on e.id=f.event_id
 left join public.league_sessions s on s.id=f.session_id
 left join public.feedback_management m on m.feedback_id=f.id
 where f.kind='feedback' order by f.created_at desc,f.id;
end;
$$;
create or replace function public.set_universal_feedback_status(p_feedback uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.event_members where user_id=auth.uid() and role='admin' and developer=true) then
   raise exception 'Developer access required' using errcode='42501';
 end if;
 if p_status is null or p_status not in ('new','in_progress','resolved') then raise exception 'Invalid feedback status'; end if;
 if not exists(select 1 from public.field_log where id=p_feedback and kind='feedback') then raise exception 'Feedback not found'; end if;
 insert into public.feedback_management(feedback_id,status,updated_at) values(p_feedback,p_status,now())
 on conflict(feedback_id) do update set status=excluded.status,updated_at=excluded.updated_at;
end;
$$;
revoke all on function public.list_universal_feedback() from public,anon;
revoke all on function public.set_universal_feedback_status(uuid,text) from public,anon;
grant execute on function public.list_universal_feedback() to authenticated;
grant execute on function public.set_universal_feedback_status(uuid,text) to authenticated;
commit;
