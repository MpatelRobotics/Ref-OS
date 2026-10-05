-- Run after schema.sql and refos-2-developer-access.sql. Safe to re-run.
begin;
create table if not exists public.feedback_management (
  feedback_id uuid primary key references public.field_log(id) on delete cascade,
  status text not null check (status in ('new','in_progress','resolved')),
  updated_at timestamptz not null default now()
);
alter table public.feedback_management enable row level security;
revoke all on public.feedback_management from anon, authenticated;

create or replace function public.list_feedback_management(p_event uuid)
returns table(feedback_id uuid, status text, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.event_members where event_id=p_event and user_id=auth.uid() and role='admin' and developer=true) then
    raise exception 'Developer access required' using errcode='42501';
  end if;
  return query select m.feedback_id,m.status,m.updated_at from public.feedback_management m
    join public.field_log f on f.id=m.feedback_id where f.event_id=p_event and f.kind='feedback';
end;
$$;
create or replace function public.set_feedback_status(p_event uuid,p_feedback uuid,p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.event_members where event_id=p_event and user_id=auth.uid() and role='admin' and developer=true) then
    raise exception 'Developer access required' using errcode='42501';
  end if;
  if p_status is null or p_status not in ('new','in_progress','resolved') then raise exception 'Invalid feedback status'; end if;
  if not exists (select 1 from public.field_log where id=p_feedback and event_id=p_event and kind='feedback') then raise exception 'Feedback not found in this event'; end if;
  insert into public.feedback_management(feedback_id,status,updated_at) values(p_feedback,p_status,now())
    on conflict(feedback_id) do update set status=excluded.status,updated_at=excluded.updated_at;
end;
$$;
revoke all on function public.list_feedback_management(uuid) from public,anon;
revoke all on function public.set_feedback_status(uuid,uuid,text) from public,anon;
grant execute on function public.list_feedback_management(uuid) to authenticated;
grant execute on function public.set_feedback_status(uuid,uuid,text) to authenticated;
commit;
