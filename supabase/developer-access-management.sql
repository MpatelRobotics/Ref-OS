-- Run after developer-passkeys.sql and developer-live-activity.sql.
begin;
alter table public.developer_passkeys add column if not exists label text not null default 'Developer passkey';
alter table public.developer_passkeys add column if not exists last_used_at timestamptz;
create or replace function public.revoke_refos_device_access(p_user uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_user is null then raise exception 'Device session required'; end if;
 delete from public.event_members where user_id=p_user;
 delete from public.developer_passkey_challenges where user_id=p_user;
 delete from public.user_live_activity where user_id=p_user;
end;
$$;
revoke all on function public.revoke_refos_device_access(uuid) from public,anon,authenticated;
grant execute on function public.revoke_refos_device_access(uuid) to service_role;
commit;
