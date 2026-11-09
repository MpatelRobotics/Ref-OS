begin;

-- Private state: event listings expose branding only, never this table or credentials.
create table if not exists public.event_admin_setup_pending (
 event_id uuid primary key references public.events(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.event_admin_setup_pending enable row level security;
revoke all on public.event_admin_setup_pending from anon, authenticated;

create or replace function public.event_requires_admin_setup(p_event uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.event_admin_setup_pending p join public.events e on e.id=p.event_id
 where p.event_id=p_event and e.archived_at is null);
$$;
revoke all on function public.event_requires_admin_setup(uuid) from public,anon;
grant execute on function public.event_requires_admin_setup(uuid) to authenticated;

-- Every login path must pass through membership creation. Only verified developers may
-- join a pending event; ordinary logins (including personal passcodes) stay blocked.
create or replace function public.guard_pending_admin_membership()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.event_admin_setup_pending where event_id=new.event_id)
    and not (coalesce(new.developer,false) and new.role='admin') then
   raise exception 'Create an admin code before entering this event.' using errcode='42501';
 end if;
 return new;
end;
$$;
drop trigger if exists zz_pending_admin_membership on public.event_members;
create trigger zz_pending_admin_membership before insert or update on public.event_members
for each row execute function public.guard_pending_admin_membership();

create or replace function public.has_event_role(p_event uuid,p_roles text[])
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.event_members m where m.event_id=p_event and m.user_id=auth.uid()
 and m.role=any(p_roles) and (m.developer or not exists(
 select 1 from public.event_admin_setup_pending p where p.event_id=p_event)));
$$;

-- Service role only: the Edge Function verifies the existing developer secret first.
create or replace function public.create_deferred_admin_event(p_name text,p_user uuid,p_format text)
returns setof public.events language plpgsql security definer set search_path=public as $$
declare v_event public.events%rowtype;
begin
 if p_user is null or length(trim(p_name))<3 or length(p_name)>300
 or p_format not in ('tournament','league') then raise exception 'Invalid event details'; end if;
 insert into public.events(name,quals,practice,bracket,finals_best_of,join_code,created_by)
 values(trim(p_name),0,0,0,1,upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),p_user)
 returning * into v_event;
 insert into public.event_admin_setup_pending(event_id) values(v_event.id);
 perform public.claim_developer_event_access(v_event.id,p_user);
 perform public.seed_refos_event_rules(v_event.id);
 if p_format='league' then
   perform set_config('refos.format_change','on',true);
   update public.events set event_format='league' where id=v_event.id returning * into v_event;
   perform set_config('refos.format_change','off',true);
 end if;
 return next v_event;
end;
$$;
revoke all on function public.create_deferred_admin_event(text,uuid,text) from public,anon,authenticated;
grant execute on function public.create_deferred_admin_event(text,uuid,text) to service_role;

-- First join wins atomically. Losing/concurrent requests cannot overwrite the chosen code.
create or replace function public.complete_initial_admin_setup(p_event uuid,p_user uuid,p_code text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_user is null or p_code !~ '^[0-9][A-Z][0-9][0-9]$' or p_code is null then
   raise exception 'Use number, letter, number, number for the admin code.';
 end if;
 perform 1 from public.events where id=p_event and archived_at is null for update;
 if not found then raise exception 'Event unavailable'; end if;
 delete from public.event_admin_setup_pending where event_id=p_event;
 if not found then raise exception 'Admin setup is already complete. Sign in with the event code.'; end if;
 insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
 values(p_event,'admin_keypad','admin',encode(extensions.digest(p_code,'sha256'::text),'hex'),true);
 insert into public.event_members(event_id,user_id,role,developer) values(p_event,p_user,'admin',false)
 on conflict(event_id,user_id) do update set role='admin',developer=false;
end;
$$;
revoke all on function public.complete_initial_admin_setup(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.complete_initial_admin_setup(uuid,uuid,text) to service_role;
commit;
