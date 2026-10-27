-- Run after developer-access-management.sql.
create or replace function public.revoke_all_refos_device_access(p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare device_count integer;membership_count integer;protected_users uuid[];
begin
 if p_actor is null or not exists(select 1 from public.event_members where user_id=p_actor and role='admin' and developer=true)
 then raise exception 'Developer access required';end if;
 -- Preserve every device sign-in with Admin access to any event, including Developers.
 select coalesce(array_agg(distinct user_id),array[]::uuid[]) into protected_users from public.event_members where role='admin';
 perform pg_advisory_xact_lock(720273);
 with removed as (delete from public.event_members where not(user_id=any(protected_users)) returning user_id)
 select count(distinct user_id)::integer,count(*)::integer into device_count,membership_count from removed;
 delete from public.developer_passkey_challenges where not(user_id=any(protected_users));
 delete from public.user_live_activity where not(user_id=any(protected_users));
 return jsonb_build_object('devices',device_count,'memberships',membership_count);
end;
$$;
revoke all on function public.revoke_all_refos_device_access(uuid) from public,anon,authenticated;
grant execute on function public.revoke_all_refos_device_access(uuid) to service_role;
