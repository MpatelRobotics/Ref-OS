begin;
create table if not exists public.judge_shared_credentials(event_id uuid primary key references public.events(id) on delete cascade,code_hash text not null,enabled boolean not null default true,generation uuid not null default gen_random_uuid());
create table if not exists public.judge_shared_tickets(event_id uuid references public.events(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,generation uuid not null,expires_at timestamptz not null,primary key(event_id,user_id));
create table if not exists public.judge_shared_sessions(event_id uuid references public.events(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,primary key(event_id,user_id));
alter table public.judge_shared_credentials enable row level security;
alter table public.judge_shared_tickets enable row level security;
alter table public.judge_shared_sessions enable row level security;
revoke all on public.judge_shared_credentials,public.judge_shared_tickets,public.judge_shared_sessions from anon,authenticated;
create or replace function public.manage_shared_judge_code(p_event uuid,p_disable boolean default false) returns text language plpgsql security definer set search_path=public,extensions as $$
declare code text;b bytea;
begin
 if not public.has_event_role(p_event,array['admin','judge']) then raise exception 'Judge Advisor access required';end if;
 perform 1 from public.judge_shared_credentials where event_id=p_event for update;
 delete from public.judge_group_sessions s using public.judge_shared_sessions origin where s.event_id=p_event and origin.event_id=s.event_id and origin.user_id=s.user_id;
 delete from public.judge_shared_sessions where event_id=p_event;delete from public.judge_shared_tickets where event_id=p_event;
 if p_disable then update public.judge_shared_credentials set enabled=false,generation=gen_random_uuid() where event_id=p_event;return null;end if;
 loop b=gen_random_bytes(5);code=(get_byte(b,0)%10)::text||chr(65+get_byte(b,1)%26)||(get_byte(b,2)%10)::text||chr(65+get_byte(b,3)%26)||(get_byte(b,4)%10)::text;exit when not exists(select 1 from public.judge_group_credentials where event_id=p_event and code_hash=encode(digest(code,'sha256'),'hex'));end loop;
 insert into public.judge_shared_credentials(event_id,code_hash) values(p_event,encode(digest(code,'sha256'),'hex')) on conflict(event_id) do update set code_hash=excluded.code_hash,enabled=true,generation=gen_random_uuid();return code;
end;$$;
create or replace function public.shared_judge_code_status(p_event uuid) returns boolean language plpgsql security definer set search_path=public as $$begin if not public.has_event_role(p_event,array['admin','judge']) then raise exception 'Judge Advisor access required';end if;return coalesce((select enabled from public.judge_shared_credentials where event_id=p_event),false);end;$$;
-- Preserve the original rate-limited individual login, privately.
do $$begin if to_regprocedure('public.login_individual_judge_group(uuid,text)') is null then alter function public.login_judge_group(uuid,text) rename to login_individual_judge_group;end if;end;$$;
revoke all on function public.login_individual_judge_group(uuid,text) from public,anon,authenticated;
create or replace function public.login_judge_group(p_event uuid,p_code text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare credential public.judge_shared_credentials%rowtype;result jsonb;locked timestamptz;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 insert into public.event_access_attempts(event_id,user_id) values(p_event,auth.uid()) on conflict do nothing;
 select locked_until into locked from public.event_access_attempts where event_id=p_event and user_id=auth.uid() for update;
 if locked>now() then return jsonb_build_object('ok',false,'message','Too many attempts. Try again in five minutes.');end if;
 select * into credential from public.judge_shared_credentials where event_id=p_event and enabled and code_hash=encode(digest(upper(trim(p_code)),'sha256'),'hex') for share;
 if found then
 delete from public.event_access_attempts where event_id=p_event and user_id=auth.uid();
 insert into public.judge_shared_tickets values(p_event,auth.uid(),credential.generation,now()+interval '5 minutes') on conflict(event_id,user_id) do update set generation=excluded.generation,expires_at=excluded.expires_at;
 return jsonb_build_object('ok',true,'chooseGroup',true,'groups',coalesce((select jsonb_agg(group_name order by group_name) from public.judge_group_credentials where event_id=p_event and enabled),'[]'));
 end if;
 result=public.login_individual_judge_group(p_event,p_code);
 if (result->>'ok')::boolean then delete from public.judge_shared_sessions where event_id=p_event and user_id=auth.uid();delete from public.judge_shared_tickets where event_id=p_event and user_id=auth.uid();end if;
 return result;
end;$$;
create or replace function public.choose_shared_judge_group(p_event uuid,p_group text) returns jsonb language plpgsql security definer set search_path=public as $$
declare credential public.judge_group_credentials%rowtype;
begin
 perform 1 from public.judge_shared_tickets t join public.judge_shared_credentials c on c.event_id=t.event_id and c.generation=t.generation and c.enabled where t.event_id=p_event and t.user_id=auth.uid() and t.expires_at>now() for share of c;
 if not found then raise exception 'Shared login expired or disabled. Enter the event judge code again.';end if;
 select * into credential from public.judge_group_credentials where event_id=p_event and group_name=p_group and enabled for share;
 if not found then raise exception 'This judge group is disabled or deleted';end if;
 insert into public.judge_group_sessions values(p_event,auth.uid(),credential.group_name,credential.generation,now()+interval '12 hours') on conflict(event_id,user_id) do update set group_name=excluded.group_name,generation=excluded.generation,expires_at=excluded.expires_at;
 insert into public.judge_shared_sessions values(p_event,auth.uid()) on conflict do nothing;
 delete from public.judge_shared_tickets where event_id=p_event and user_id=auth.uid();
 return jsonb_build_object('ok',true,'group',p_group);
end;$$;
revoke all on function public.manage_shared_judge_code(uuid,boolean),public.shared_judge_code_status(uuid),public.login_judge_group(uuid,text),public.choose_shared_judge_group(uuid,text) from public,anon;
grant execute on function public.manage_shared_judge_code(uuid,boolean),public.shared_judge_code_status(uuid),public.login_judge_group(uuid,text),public.choose_shared_judge_group(uuid,text) to authenticated;
create or replace function public.create_judge_group_code(p_event uuid,p_group text)
returns text language plpgsql security definer set search_path=public,extensions as $$
declare code text;bytes bytea;
begin
 if not public.has_event_role(p_event,array['admin','judge']) then raise exception 'Judge Advisor access required'; end if;
 if length(trim(p_group)) not between 1 and 100 or p_group is null then raise exception 'Enter a judge group name';end if;
 loop
 bytes=gen_random_bytes(5);code=(get_byte(bytes,0)%10)::text||chr(65+get_byte(bytes,1)%26)||(get_byte(bytes,2)%10)::text||chr(65+get_byte(bytes,3)%26)||(get_byte(bytes,4)%10)::text;
 exit when not exists(select 1 from public.judge_group_credentials where event_id=p_event and code_hash=encode(digest(code,'sha256'),'hex')) and not exists(select 1 from public.judge_shared_credentials where event_id=p_event and code_hash=encode(digest(code,'sha256'),'hex'));
 end loop;
 insert into public.judge_group_credentials(event_id,group_name,code_hash) values(p_event,trim(p_group),encode(digest(code,'sha256'),'hex'))
 on conflict(event_id,group_name) do update set code_hash=excluded.code_hash,enabled=true,generation=gen_random_uuid();
 return code;
end;$$;

commit;
