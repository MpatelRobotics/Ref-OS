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

create table if not exists public.judging_portal_codes(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 label text not null check(length(trim(label)) between 1 and 100),
 code_hash text not null,
 mode text not null check(mode in ('manual','random')),
 group_name text,
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 foreign key(event_id,group_name) references public.judge_group_credentials(event_id,group_name) on delete cascade,
 unique(event_id,code_hash)
);
create table if not exists public.judging_portal_logins(
 event_id uuid references public.events(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 code_id uuid not null references public.judging_portal_codes(id) on delete cascade,
 primary key(event_id,user_id)
);
create table if not exists public.judging_interview_notes(
 event_id uuid not null references public.events(id) on delete cascade,
 session_id uuid references public.league_sessions(id) on delete cascade,
 session_key uuid generated always as (coalesce(session_id,'00000000-0000-0000-0000-000000000000'::uuid)) stored,
 group_name text not null,
 team text not null,
 notes text not null check(length(notes)<=20000),
 version integer not null default 1,
 updated_at timestamptz not null default now(),
 foreign key(event_id,group_name) references public.judge_group_credentials(event_id,group_name) on delete cascade,
 primary key(event_id,session_key,group_name,team)
);
alter table public.judging_portal_codes enable row level security;
alter table public.judging_portal_logins enable row level security;
alter table public.judging_interview_notes enable row level security;
revoke all on public.judging_portal_codes,public.judging_portal_logins,public.judging_interview_notes from anon,authenticated;

create or replace function public.require_judging_group_access(p_event uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not exists(select 1 from public.events where id=p_event and archived_at is null)
 or public.event_requires_admin_setup(p_event) then raise exception 'Event is unavailable or setup is incomplete';end if;
 if not exists(select 1 from public.judging_portal_logins l join public.judging_portal_codes c on c.id=l.code_id and c.event_id=l.event_id and c.enabled
 join public.judge_group_sessions s on s.event_id=l.event_id and s.user_id=l.user_id and s.group_name=c.group_name
 join public.judge_group_credentials g on g.event_id=s.event_id and g.group_name=s.group_name and g.enabled and g.generation=s.generation
 where l.event_id=p_event and l.user_id=auth.uid() and s.expires_at>now()) then raise exception 'Judge-group login expired or disabled';end if;
end;$$;
revoke all on function public.require_judging_group_access(uuid) from public,anon;
grant execute on function public.require_judging_group_access(uuid) to authenticated;

create or replace function public.create_judging_portal_code(p_event uuid,p_label text,p_mode text,p_group text default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_code text; v_id uuid;
begin
 perform public.require_judging_preview(p_event);
 if p_label is null or length(trim(p_label)) not between 1 and 100 or p_mode is null or p_mode not in ('manual','random') then raise exception 'Enter a judge name and assignment mode';end if;
 if p_mode='manual' and not exists(select 1 from public.judge_group_credentials where event_id=p_event and group_name=p_group and enabled) then raise exception 'Choose an enabled judge group';end if;
 if not exists(select 1 from public.judge_group_credentials where event_id=p_event and enabled) then raise exception 'Create an enabled judge group first';end if;
 v_code='J-'||upper(encode(gen_random_bytes(6),'hex'));
 insert into public.judging_portal_codes(event_id,label,code_hash,mode,group_name)
 values(p_event,trim(p_label),encode(digest(v_code,'sha256'),'hex'),p_mode,case when p_mode='manual' then p_group else null end) returning id into v_id;
 return jsonb_build_object('id',v_id,'code',v_code);
end;$$;

create or replace function public.list_judging_portal_codes(p_event uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 perform public.require_judging_preview(p_event);
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',label,'mode',mode,'group',group_name,'enabled',enabled) order by created_at) from public.judging_portal_codes where event_id=p_event),'[]'::jsonb);
end;$$;

create or replace function public.disable_judging_portal_code(p_event uuid,p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 perform public.require_judging_preview(p_event);
 update public.judging_portal_codes set enabled=false where event_id=p_event and id=p_id;
 delete from public.judge_group_sessions s using public.judging_portal_logins l
 where s.event_id=p_event and s.event_id=l.event_id and s.user_id=l.user_id and l.code_id=p_id;
end;$$;

create or replace function public.login_judging_portal_code(p_event uuid,p_code text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare c public.judging_portal_codes%rowtype; g text; gen uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.events where id=p_event and archived_at is null) or public.event_requires_admin_setup(p_event) then raise exception 'Event is unavailable or setup is incomplete';end if;
 if public.refos_access_locked(p_event,auth.uid()) then return jsonb_build_object('ok',false,'message','Too many attempts. Try again later.');end if;
 -- Serialize assignments within this event so simultaneous first logins stay balanced.
 perform 1 from public.events where id=p_event for update;
 select * into c from public.judging_portal_codes where event_id=p_event and enabled and code_hash=encode(digest(upper(trim(p_code)),'sha256'),'hex') for update;
 if not found then
 perform public.refos_access_attempt(p_event,auth.uid(),false);
 return jsonb_build_object('ok',false,'message','Incorrect or disabled judge code.');end if;
 g=c.group_name;
 if g is null and c.mode='random' then
 select gc.group_name into g from public.judge_group_credentials gc
 where gc.event_id=p_event and gc.enabled
 order by (select count(*) from public.judging_portal_codes pc where pc.event_id=p_event and pc.group_name=gc.group_name and pc.enabled),random() limit 1;
 if g is null then raise exception 'No enabled judge groups. Ask the Judge Advisor.';end if;
 update public.judging_portal_codes set group_name=g where id=c.id;
 end if;
 select generation into gen from public.judge_group_credentials where event_id=p_event and group_name=g and enabled;
 if gen is null then raise exception 'Assigned group is disabled. Ask the Judge Advisor for a new code.';end if;
 insert into public.judge_group_sessions(event_id,user_id,group_name,generation,expires_at)
 values(p_event,auth.uid(),g,gen,now()+interval '12 hours')
 on conflict(event_id,user_id) do update set group_name=excluded.group_name,generation=excluded.generation,expires_at=excluded.expires_at;
 insert into public.judging_portal_logins(event_id,user_id,code_id) values(p_event,auth.uid(),c.id)
 on conflict(event_id,user_id) do update set code_id=excluded.code_id;
 perform public.refos_access_attempt(p_event,auth.uid(),true);
 return jsonb_build_object('ok',true,'group',g);
end;$$;

create or replace function public.list_judging_interview_notes(p_event uuid,p_advisor boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g text;
begin
 if coalesce(p_advisor,false) then perform public.require_judging_preview(p_event);else perform public.require_judging_group_access(p_event);end if;
 if not coalesce(p_advisor,false) then g=public.judge_group_dashboard(p_event)->>'group';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('team',team,'group',group_name,'session_id',session_id,'notes',notes,'version',version,'updated_at',updated_at) order by team)
 from public.judging_interview_notes where event_id=p_event and (coalesce(p_advisor,false) or group_name=g)),'[]'::jsonb);
end;$$;

create or replace function public.save_judging_interview_notes(p_event uuid,p_session uuid,p_team text,p_notes text,p_version integer)
returns integer language plpgsql security definer set search_path=public as $$
declare dashboard jsonb;g text;v integer;k uuid=coalesce(p_session,'00000000-0000-0000-0000-000000000000'::uuid);
begin
 perform public.require_judging_group_access(p_event);
 dashboard=public.judge_group_dashboard(p_event);g=dashboard->>'group';
 if not exists(select 1 from jsonb_array_elements(dashboard->'interviews') i where i->>'team'=p_team and (i->>'session_id')::uuid is not distinct from p_session) then raise exception 'Team is not assigned to this judge group';end if;
 if p_notes is null or length(p_notes)>20000 then raise exception 'Notes must be under 20,000 characters';end if;
 if not exists(select 1 from public.judge_group_conflicts where event_id=p_event and group_name=g and version>0) then raise exception 'Declare group conflicts before adding notes';end if;
 if exists(select 1 from public.judge_group_conflicts where event_id=p_event and group_name=g and p_team=any(conflict_teams)) then raise exception 'This team is a declared conflict';end if;
 insert into public.judging_interview_notes(event_id,session_id,group_name,team,notes,version) values(p_event,p_session,g,p_team,'',0) on conflict do nothing;
 select version into v from public.judging_interview_notes where event_id=p_event and session_key=k and group_name=g and team=p_team for update;
 if p_version is null or p_version<>v then raise exception 'Notes changed on another device. Reload before editing.' using errcode='40001';end if;
 update public.judging_interview_notes set notes=p_notes,version=v+1,updated_at=now() where event_id=p_event and session_key=k and group_name=g and team=p_team;
 return v+1;
end;$$;
revoke all on function public.create_judging_portal_code(uuid,text,text,text),public.list_judging_portal_codes(uuid),public.disable_judging_portal_code(uuid,uuid),public.login_judging_portal_code(uuid,text),public.list_judging_interview_notes(uuid,boolean),public.save_judging_interview_notes(uuid,uuid,text,text,integer) from public,anon;
grant execute on function public.create_judging_portal_code(uuid,text,text,text),public.list_judging_portal_codes(uuid),public.disable_judging_portal_code(uuid,uuid),public.login_judging_portal_code(uuid,text),public.list_judging_interview_notes(uuid,boolean),public.save_judging_interview_notes(uuid,uuid,text,text,integer) to authenticated;
create or replace function public.judging_portal_dashboard(p_event uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 perform public.require_judging_group_access(p_event);
 return public.judge_group_dashboard(p_event);
end;$$;
revoke all on function public.judging_portal_dashboard(uuid) from public,anon;
grant execute on function public.judging_portal_dashboard(uuid) to authenticated;
-- Schedule changes can reach the developer workspace immediately through Realtime.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='judging_interview_schedules') then
 alter publication supabase_realtime add table public.judging_interview_schedules;
 end if;
end;$$;
commit;
