-- Ref OS 1.2 server enforced access migration
-- REQUIRED: enable Anonymous Sign-Ins in Supabase Auth before deploying this build.

create extension if not exists pgcrypto;

alter table public.event_members add column if not exists role text not null default 'ref';

create table if not exists public.event_settings (
  event_id   uuid references public.events(id) on delete cascade,
  key        text not null,
  value      jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz default now(),
  primary key (event_id, key)
);
alter table public.event_settings enable row level security;

create table if not exists public.event_access_credentials (
  event_id        uuid references public.events(id) on delete cascade,
  credential_name text not null,
  role            text not null check (role in ('ref','judge','emcee','inspection','admin')),
  credential_hash text not null,
  enabled         boolean not null default true,
  updated_at      timestamptz default now(),
  primary key (event_id, credential_name)
);
alter table public.event_access_credentials enable row level security;


create table if not exists public.event_access_attempts (
  event_id       uuid references public.events(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete cascade,
  failed_count   int not null default 0,
  window_started timestamptz not null default now(),
  locked_until   timestamptz,
  primary key (event_id,user_id)
);
alter table public.event_access_attempts enable row level security;

create or replace function public.has_event_role(p_event uuid, p_roles text[])
returns boolean language sql security definer stable
set search_path = public, extensions as $$
  select exists (
    select 1 from public.event_members m
    where m.event_id = p_event and m.user_id = auth.uid() and m.role = any(p_roles)
  );
$$;

create or replace function public.claim_event_access(p_event uuid, p_credential text)
returns table(role text, is_admin boolean)
language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_role text;
  v_hash text;
  v_attempt public.event_access_attempts%rowtype;
  v_failed int;
begin
  if auth.uid() is null then
    raise exception 'Authentication session required';
  end if;

  select * into v_attempt
  from public.event_access_attempts
  where event_id=p_event and user_id=auth.uid();

  if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    raise exception 'Too many login attempts. Try again in a few minutes.';
  end if;

  v_hash := encode(digest(coalesce(p_credential,''), 'sha256'), 'hex');

  select c.role into v_role
  from public.event_access_credentials c
  where c.event_id = p_event
    and c.enabled = true
    and c.credential_hash = v_hash
  order by case when c.role = 'admin' then 0 else 1 end
  limit 1;

  if v_role is null then
    if v_attempt.user_id is null or v_attempt.window_started < now() - interval '5 minutes' then
      v_failed := 1;
      insert into public.event_access_attempts(event_id,user_id,failed_count,window_started,locked_until)
      values(p_event,auth.uid(),1,now(),null)
      on conflict(event_id,user_id)
      do update set failed_count=1,window_started=now(),locked_until=null;
    else
      v_failed := v_attempt.failed_count + 1;
      update public.event_access_attempts
      set failed_count=v_failed,
          locked_until=case when v_failed >= 8 then now() + interval '5 minutes' else null end
      where event_id=p_event and user_id=auth.uid();
    end if;

    if v_failed >= 8 then
      raise exception 'Too many login attempts. Try again in a few minutes.';
    end if;
    raise exception 'Invalid event credential';
  end if;

  delete from public.event_access_attempts
  where event_id=p_event and user_id=auth.uid();

  insert into public.event_members(event_id, user_id, role)
  values (p_event, auth.uid(), v_role)
  on conflict (event_id, user_id)
  do update set role = excluded.role;

  return query select v_role, (v_role = 'admin');
end;
$$;

create or replace function public.set_event_access_credential(
  p_event uuid, p_name text, p_role text, p_hash text, p_enabled boolean default true
)
returns void language plpgsql security definer set search_path=public, extensions as $$
begin
  if not public.has_event_role(p_event,array['admin']) then raise exception 'Admin role required'; end if;
  if p_role not in ('ref','judge','emcee','inspection','admin') then raise exception 'Invalid role'; end if;
  insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled,updated_at)
  values(p_event,p_name,p_role,p_hash,p_enabled,now())
  on conflict(event_id,credential_name)
  do update set role=excluded.role,credential_hash=excluded.credential_hash,enabled=excluded.enabled,updated_at=now();
end;
$$;

create or replace function public.disable_event_access_credential(p_event uuid,p_name text)
returns void language plpgsql security definer set search_path=public, extensions as $$
begin
  if not public.has_event_role(p_event,array['admin']) then raise exception 'Admin role required'; end if;
  update public.event_access_credentials set enabled=false,updated_at=now()
  where event_id=p_event and credential_name=p_name;
end;
$$;

insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
select id,'admin_keypad','admin',encode(digest('1A23','sha256'),'hex'),true
from public.events
where id='11111111-1111-4111-8111-111111111111'
on conflict(event_id,credential_name)
do update set role=excluded.role,credential_hash=excluded.credential_hash,enabled=true;

create table if not exists public.ref_roster (
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  last_seen timestamptz not null default now(),
  role text,
  primary key (event_id, name)
);
alter table public.ref_roster add column if not exists role text;
alter table public.ref_roster enable row level security;

drop policy if exists "ref roster read" on public.ref_roster;
drop policy if exists "ref roster insert" on public.ref_roster;
drop policy if exists "ref roster update" on public.ref_roster;
drop policy if exists "ref roster delete" on public.ref_roster;
create policy "ref roster read" on public.ref_roster for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "ref roster insert" on public.ref_roster for insert
  with check (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "ref roster update" on public.ref_roster for update
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']))
  with check (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "ref roster delete" on public.ref_roster for delete
  using (public.has_event_role(event_id,array['admin']));

-- Carry forward any already generated volunteer code hashes from Ref OS 1.1.
insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
select event_id,'ref_code','ref',value #>> '{codes,ref,hash}',
       coalesce((value #>> '{codes,ref,enabled}')::boolean,false)
from public.event_settings
where key='role_access_codes' and value #>> '{codes,ref,hash}' is not null
on conflict(event_id,credential_name)
do update set credential_hash=excluded.credential_hash,enabled=excluded.enabled,updated_at=now();

insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
select event_id,'judge_code','judge',value #>> '{codes,judge,hash}',
       coalesce((value #>> '{codes,judge,enabled}')::boolean,false)
from public.event_settings
where key='role_access_codes' and value #>> '{codes,judge,hash}' is not null
on conflict(event_id,credential_name)
do update set credential_hash=excluded.credential_hash,enabled=excluded.enabled,updated_at=now();

insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
select event_id,'emcee_code','emcee',value #>> '{codes,emcee,hash}',
       coalesce((value #>> '{codes,emcee,enabled}')::boolean,false)
from public.event_settings
where key='role_access_codes' and value #>> '{codes,emcee,hash}' is not null
on conflict(event_id,credential_name)
do update set credential_hash=excluded.credential_hash,enabled=excluded.enabled,updated_at=now();

-- Replace permissive app data policies with membership and role based policies.
drop policy if exists "open read events" on public.events;
drop policy if exists "open update events" on public.events;
drop policy if exists "members read events" on public.events;
drop policy if exists "members update events" on public.events;
create policy "members read events" on public.events for select
  using (public.has_event_role(id,array['ref','judge','emcee','admin']));
drop policy if exists "admins update events" on public.events;
create policy "admins update events" on public.events for update
  using (public.has_event_role(id,array['admin']))
  with check (public.has_event_role(id,array['admin']));

drop policy if exists "join self" on public.event_members;
drop policy if exists "read memberships" on public.event_members;
drop policy if exists "leave self" on public.event_members;
drop policy if exists "members read memberships" on public.event_members;
drop policy if exists "members leave self" on public.event_members;
create policy "members read memberships" on public.event_members for select
  using (user_id=auth.uid() or public.has_event_role(event_id,array['admin']));
create policy "members leave self" on public.event_members for delete
  using (user_id=auth.uid());

drop policy if exists "open rw event settings" on public.event_settings;
drop policy if exists "members read event settings" on public.event_settings;
drop policy if exists "admins write event settings" on public.event_settings;
create policy "members read event settings" on public.event_settings for select
  using (
    public.has_event_role(event_id,array['admin'])
    or (
      key <> 'role_access_codes'
      and public.has_event_role(event_id,array['ref','judge','emcee'])
    )
  );
create policy "admins write event settings" on public.event_settings for all
  using (public.has_event_role(event_id,array['admin']))
  with check (public.has_event_role(event_id,array['admin']));

drop policy if exists "open rw teams" on public.teams;
drop policy if exists "members read teams" on public.teams;
drop policy if exists "refs write teams" on public.teams;
create policy "members read teams" on public.teams for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "refs write teams" on public.teams for all
  using (public.has_event_role(event_id,array['ref','admin']))
  with check (public.has_event_role(event_id,array['ref','admin']));

drop policy if exists "open rw violations" on public.violations;
drop policy if exists "members read violations" on public.violations;
drop policy if exists "refs write violations" on public.violations;
alter table public.violations add column if not exists logged_by_user uuid default auth.uid();
drop policy if exists "refs insert own violations" on public.violations;
drop policy if exists "refs update own violations" on public.violations;
drop policy if exists "refs delete own violations" on public.violations;
create policy "members read violations" on public.violations for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "refs insert own violations" on public.violations for insert
  with check (public.has_event_role(event_id,array['ref','admin']) and logged_by_user = auth.uid());
create policy "refs update own violations" on public.violations for update
  using (public.has_event_role(event_id,array['admin']) or (public.has_event_role(event_id,array['ref']) and logged_by_user = auth.uid()))
  with check (public.has_event_role(event_id,array['admin']) or (public.has_event_role(event_id,array['ref']) and logged_by_user = auth.uid()));
create policy "refs delete own violations" on public.violations for delete
  using (public.has_event_role(event_id,array['admin']) or (public.has_event_role(event_id,array['ref']) and logged_by_user = auth.uid()));

drop policy if exists "open rw matches" on public.matches;
drop policy if exists "members read matches" on public.matches;
drop policy if exists "field roles write matches" on public.matches;
create policy "members read matches" on public.matches for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "field roles write matches" on public.matches for all
  using (public.has_event_role(event_id,array['ref','emcee','admin']))
  with check (public.has_event_role(event_id,array['ref','emcee','admin']));

drop policy if exists "open rw rules" on public.rules;
drop policy if exists "members read rules" on public.rules;
drop policy if exists "admins write rules" on public.rules;
create policy "members read rules" on public.rules for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "admins write rules" on public.rules for all
  using (public.has_event_role(event_id,array['admin']))
  with check (public.has_event_role(event_id,array['admin']));

drop policy if exists "open rw nominations" on public.nominations;
drop policy if exists "members read nominations" on public.nominations;
drop policy if exists "ref judge write nominations" on public.nominations;
create policy "members read nominations" on public.nominations for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "ref judge write nominations" on public.nominations for all
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']))
  with check (public.has_event_role(event_id,array['ref','judge','emcee','admin']));

drop policy if exists "open rw shortlist" on public.shortlist;
drop policy if exists "members read shortlist" on public.shortlist;
drop policy if exists "judge write shortlist" on public.shortlist;
create policy "members read shortlist" on public.shortlist for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "judge write shortlist" on public.shortlist for all
  using (public.has_event_role(event_id,array['judge','admin']))
  with check (public.has_event_role(event_id,array['judge','admin']));

drop policy if exists "open rw watch_notes" on public.watch_notes;
drop policy if exists "members read watch notes" on public.watch_notes;
drop policy if exists "refs write watch notes" on public.watch_notes;
create policy "members read watch notes" on public.watch_notes for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "refs write watch notes" on public.watch_notes for all
  using (public.has_event_role(event_id,array['ref','admin']))
  with check (public.has_event_role(event_id,array['ref','admin']));

drop policy if exists "open rw field_log" on public.field_log;
drop policy if exists "members read field log" on public.field_log;
drop policy if exists "event roles write field log" on public.field_log;
create policy "members read field log" on public.field_log for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "event roles write field log" on public.field_log for all
  using (public.has_event_role(event_id,array['ref','emcee','admin']))
  with check (public.has_event_role(event_id,array['ref','emcee','admin']));
drop policy if exists "judges request role code regeneration" on public.field_log;
create policy "judges request role code regeneration" on public.field_log for insert
  with check (public.has_event_role(event_id,array['judge']) and kind in ('role_code_request','help_request'));

drop policy if exists "open rw alliances" on public.alliances;
drop policy if exists "members read alliances" on public.alliances;
drop policy if exists "admins write alliances" on public.alliances;
create policy "members read alliances" on public.alliances for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','admin']));
create policy "admins write alliances" on public.alliances for all
  using (public.has_event_role(event_id,array['admin']))
  with check (public.has_event_role(event_id,array['admin']));

-- Robot photos are private. Reads, uploads, and deletes require event membership.
update storage.buckets set public=false where id='robot-photos';
drop policy if exists "open read photos" on storage.objects;
drop policy if exists "members read photos" on storage.objects;
create policy "members read photos" on storage.objects for select
using (
  bucket_id='robot-photos'
  and public.has_event_role((storage.foldername(name))[1]::uuid,array['ref','judge','emcee','admin'])
);

drop policy if exists "open upload photos" on storage.objects;
drop policy if exists "open delete photos" on storage.objects;
drop policy if exists "members upload photos" on storage.objects;
drop policy if exists "members delete photos" on storage.objects;
create policy "members upload photos" on storage.objects for insert
with check (
  bucket_id='robot-photos'
  and public.has_event_role((storage.foldername(name))[1]::uuid,array['ref','admin'])
);
create policy "members delete photos" on storage.objects for delete
using (
  bucket_id='robot-photos'
  and public.has_event_role((storage.foldername(name))[1]::uuid,array['ref','admin'])
);

-- Credentials are never directly readable by the browser.
drop policy if exists "credentials direct access" on public.event_access_credentials;



create or replace function public.set_my_event_member_name(p_event uuid, p_name text)
returns void language plpgsql security definer set search_path=public, extensions as $$
begin
  if auth.uid() is null then raise exception 'Authentication session required'; end if;
  update public.event_members
  set name=trim(coalesce(p_name,''))
  where event_id=p_event and user_id=auth.uid();
end;
$$;

create or replace function public.downgrade_my_event_role(p_event uuid, p_role text)
returns void language plpgsql security definer set search_path=public, extensions as $$
begin
  if p_role not in ('ref','judge','emcee') then raise exception 'Invalid downgrade role'; end if;
  if not public.has_event_role(p_event,array['admin']) then raise exception 'Admin role required'; end if;
  update public.event_members
  set role=p_role
  where event_id=p_event and user_id=auth.uid();
end;
$$;


revoke all on function public.claim_event_access(uuid,text) from anon;
grant execute on function public.claim_event_access(uuid,text) to authenticated;
revoke all on function public.set_event_access_credential(uuid,text,text,text,boolean) from anon;
grant execute on function public.set_event_access_credential(uuid,text,text,text,boolean) to authenticated;
revoke all on function public.disable_event_access_credential(uuid,text) from anon;
grant execute on function public.disable_event_access_credential(uuid,text) to authenticated;
revoke all on function public.downgrade_my_event_role(uuid,text) from anon;
grant execute on function public.downgrade_my_event_role(uuid,text) to authenticated;
revoke all on function public.set_my_event_member_name(uuid,text) from anon;
grant execute on function public.set_my_event_member_name(uuid,text) to authenticated;


-- Disable legacy event join/create RPCs that bypass Ref OS 1.2 credential roles.
revoke execute on function public.join_event_by_code(text) from anon, authenticated;
revoke execute on function public.create_event(text,int,int,int,int) from anon, authenticated;


-- Shared settings must participate in Realtime so countdown/contact/code changes reach other devices.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='event_settings'
  ) then
    alter publication supabase_realtime add table public.event_settings;
  end if;
end $$;
