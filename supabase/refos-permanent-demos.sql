-- Run once in the Supabase SQL Editor. Rerunnable; preserves visitor changes.
begin;
insert into public.event_settings(event_id,key,value)
select id,'system_protection','{"protected":true}'::jsonb from public.events
where id in ('5296a93c-792b-4ba1-9da2-b7df52d20d88','80286e06-0548-43be-9c0f-372b54e58ece')
on conflict(event_id,key) do update set value=excluded.value;
create or replace function public.claim_refos_demo_access(p_event uuid,p_code text)
returns table(role text,is_admin boolean)
language plpgsql security definer set search_path=public
as $$
begin
 if auth.uid() is null then raise exception 'Sign in before opening the demo';end if;
 if p_event not in ('5296a93c-792b-4ba1-9da2-b7df52d20d88'::uuid,'80286e06-0548-43be-9c0f-372b54e58ece'::uuid)
 or upper(trim(coalesce(p_code,'')))<>'VTOW'
 or not exists(select 1 from public.events where id=p_event and archived_at is null)
 then raise exception 'Invalid demo event or code';end if;
 insert into public.event_members(event_id,user_id,role,developer)
 values(p_event,auth.uid(),'admin',false)
 on conflict(event_id,user_id) do update set role='admin',developer=false;
 return query select 'admin'::text,true;
end;
$$;
revoke all on function public.claim_refos_demo_access(uuid,text) from public,anon;
grant execute on function public.claim_refos_demo_access(uuid,text) to authenticated;

create or replace function public.guard_refos_permanent_demo()
returns trigger language plpgsql set search_path=public as $$
declare target uuid;
begin
 if TG_TABLE_NAME='events' then target=old.id;else target=old.event_id;end if;
 if target not in ('5296a93c-792b-4ba1-9da2-b7df52d20d88'::uuid,'80286e06-0548-43be-9c0f-372b54e58ece'::uuid) then
  if TG_OP='DELETE' then return old;else return new;end if;
 end if;
 if TG_TABLE_NAME='events' then
  if TG_OP='DELETE' or new.archived_at is not null or new.name is distinct from old.name
   or new.id is distinct from old.id or new.event_format is distinct from old.event_format
  then raise exception 'Permanent demo events cannot be renamed, archived, deleted, or converted';end if;
 elsif TG_TABLE_NAME='event_access_credentials' then
  raise exception 'The permanent demo login cannot be changed';
 elsif old.key in ('competition_program','demo_event','system_protection') then
  raise exception 'Permanent demo program and protection settings cannot be changed';
 elsif TG_OP='UPDATE' and new.key in ('competition_program','demo_event','system_protection') then
  raise exception 'Permanent demo program and protection settings cannot be replaced';
 end if;
 if TG_OP='DELETE' then return old;else return new;end if;
end;
$$;
drop trigger if exists guard_refos_permanent_demo on public.events;
create trigger guard_refos_permanent_demo before update or delete on public.events for each row execute function public.guard_refos_permanent_demo();
drop trigger if exists guard_refos_permanent_demo on public.event_access_credentials;
create trigger guard_refos_permanent_demo before update or delete on public.event_access_credentials for each row execute function public.guard_refos_permanent_demo();
drop trigger if exists guard_refos_permanent_demo on public.event_settings;
create trigger guard_refos_permanent_demo before update or delete on public.event_settings for each row execute function public.guard_refos_permanent_demo();
commit;
