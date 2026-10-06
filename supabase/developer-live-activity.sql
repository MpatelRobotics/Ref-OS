-- Run after base schema, Developer access, League, and event lifecycle migrations.
begin;
create table if not exists public.user_live_activity(
 user_id uuid not null references auth.users(id) on delete cascade,
 device_id uuid not null,
 event_id uuid not null references public.events(id) on delete cascade,
 session_id uuid references public.league_sessions(id) on delete cascade,
 display_name text not null,
 screen text not null,
 activity text not null,
 visible boolean not null default true,
 updated_at timestamptz not null default now(),
 primary key(user_id,device_id)
);
create index if not exists user_live_activity_updated_idx on public.user_live_activity(updated_at);
alter table public.user_live_activity enable row level security;
revoke all on public.user_live_activity from anon,authenticated;
create or replace function public.report_live_activity(p_device uuid,p_event uuid,p_session uuid,p_name text,p_screen text,p_activity text,p_visible boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not exists(select 1 from event_members where user_id=auth.uid() and event_id=p_event) then raise exception 'Event access required' using errcode='42501'; end if;
 if p_session is not null and not exists(select 1 from league_sessions where id=p_session and event_id=p_event) then raise exception 'Invalid session'; end if;
 if p_screen not in ('Matches','Teams','Rules','Robots','Alliances','Finals','Judging','Rankings','Lost & Found','Command Center','Event Settings','Features & Guide','Feedback','Volunteer status','Other') or p_activity not in ('Viewing','Entering violation','Editing violation','Adding nomination','Viewing team','Viewing match','Viewing robot photos','Importing event data','Background') then raise exception 'Invalid activity'; end if;
 insert into user_live_activity values(auth.uid(),p_device,p_event,p_session,left(coalesce(nullif(trim(p_name),''),'Volunteer'),80),p_screen,p_activity,coalesce(p_visible,false),now())
 on conflict(user_id,device_id) do update set event_id=excluded.event_id,session_id=excluded.session_id,display_name=excluded.display_name,screen=excluded.screen,activity=excluded.activity,visible=excluded.visible,updated_at=now();
 delete from user_live_activity where updated_at < now()-interval '24 hours';
end;$$;
create or replace function public.remove_live_activity(p_device uuid)
returns void language sql security definer set search_path=public as $$ delete from user_live_activity where user_id=auth.uid() and device_id=p_device; $$;
create or replace function public.list_developer_live_activity()
returns table(device_id uuid,display_name text,event_name text,session_name text,screen text,activity text,visible boolean,updated_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from event_members where user_id=auth.uid() and role='admin' and developer=true) then raise exception 'Developer access required' using errcode='42501'; end if;
 return query select a.device_id,a.display_name,e.name,coalesce(s.name,''),a.screen,a.activity,a.visible,a.updated_at from user_live_activity a join events e on e.id=a.event_id left join league_sessions s on s.id=a.session_id where a.updated_at>now()-interval '90 seconds' and e.archived_at is null order by e.name,a.display_name;
end;$$;
revoke all on function public.report_live_activity(uuid,uuid,uuid,text,text,text,boolean) from public,anon;
revoke all on function public.remove_live_activity(uuid) from public,anon;
revoke all on function public.list_developer_live_activity() from public,anon;
grant execute on function public.report_live_activity(uuid,uuid,uuid,text,text,text,boolean) to authenticated;
grant execute on function public.remove_live_activity(uuid) to authenticated;
grant execute on function public.list_developer_live_activity() to authenticated;
commit;
