-- Run after referee-portal.sql and universal-feedback.sql.
alter table public.referee_profiles add column if not exists map_visible boolean not null default false;
alter table public.referee_profiles add column if not exists map_name text not null default '' check(length(map_name)<=60);
create or replace function public.list_referee_map()
returns table(display_name text,state text) language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','true')<>'false' then raise exception 'Referee account required';end if;
 return query select trim(p.map_name),p.region from public.referee_profiles p
 where p.map_visible=true and length(trim(p.map_name))>0
 and lower(trim(p.country)) in ('united states','united states of america','usa','us')
 and p.region=any(array['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'])
 order by p.region,p.map_name;
end;$$;
revoke all on function public.list_referee_map() from public,anon;
grant execute on function public.list_referee_map() to authenticated;

create table if not exists public.referee_portal_feedback (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 note text not null check(length(note) between 1 and 5000),
 logged_by text not null,created_at timestamptz not null default now(),
 status text not null default 'new' check(status in ('new','in_progress','resolved'))
);
create index if not exists referee_portal_feedback_user_created on public.referee_portal_feedback(user_id,created_at);
alter table public.referee_portal_feedback enable row level security;
revoke all on public.referee_portal_feedback from public,anon,authenticated;
create or replace function public.submit_referee_portal_feedback(p_id uuid,p_type text,p_message text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','true')<>'false' then raise exception 'Sign in to your referee account first';end if;
 if p_type not in ('bug','suggestion','general') or length(trim(coalesce(p_message,''))) not between 1 and 4800 then raise exception 'Choose a feedback type and enter a message of up to 4800 characters';end if;
 perform pg_advisory_xact_lock(hashtext('portal-feedback'),hashtext(auth.uid()::text));
 if exists(select 1 from public.referee_portal_feedback where id=p_id and user_id=auth.uid()) then return;end if;
 if (select count(*) from public.referee_portal_feedback where user_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'You have sent several messages. Please try again later.';end if;
 insert into public.referee_portal_feedback(id,user_id,note,logged_by) values(p_id,auth.uid(),'['||p_type||'] '||trim(p_message),coalesce((select full_name from public.referee_profiles where user_id=auth.uid()),'Referee')||' ('||coalesce(auth.jwt()->>'email','')||')');
end;$$;
revoke all on function public.submit_referee_portal_feedback(uuid,text,text) from public,anon;
grant execute on function public.submit_referee_portal_feedback(uuid,text,text) to authenticated;

create or replace function public.list_universal_feedback()
returns table(id uuid,event_id uuid,event_name text,session_name text,note text,logged_by text,created_at timestamptz,status text)
language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.event_members where user_id=auth.uid() and role='admin' and developer=true) then raise exception 'Developer access required' using errcode='42501';end if;
 return query select * from (
  select f.id,f.event_id,e.name event_name,coalesce(s.name,'') session_name,f.note,f.logged_by,f.created_at,coalesce(m.status,'new') status
  from public.field_log f join public.events e on e.id=f.event_id
  left join public.league_sessions s on s.id=f.session_id left join public.feedback_management m on m.feedback_id=f.id where f.kind='feedback'
  union all select p.id,null::uuid,'Referee portal'::text,''::text,p.note,p.logged_by,p.created_at,p.status from public.referee_portal_feedback p
 ) all_feedback order by all_feedback.created_at desc,all_feedback.id;
end;$$;
create or replace function public.set_universal_feedback_status(p_feedback uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.event_members where user_id=auth.uid() and role='admin' and developer=true) then raise exception 'Developer access required' using errcode='42501';end if;
 if p_status is null or p_status not in ('new','in_progress','resolved') then raise exception 'Invalid feedback status';end if;
 update public.referee_portal_feedback set status=p_status where id=p_feedback;
 if found then return;end if;
 if not exists(select 1 from public.field_log where id=p_feedback and kind='feedback') then raise exception 'Feedback not found';end if;
 insert into public.feedback_management(feedback_id,status,updated_at) values(p_feedback,p_status,now())
 on conflict(feedback_id) do update set status=excluded.status,updated_at=excluded.updated_at;
end;$$;
revoke all on function public.list_universal_feedback(),public.set_universal_feedback_status(uuid,text) from public,anon;
grant execute on function public.list_universal_feedback(),public.set_universal_feedback_status(uuid,text) to authenticated;
