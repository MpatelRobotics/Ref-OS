-- Ref-OS 1.2 — let a volunteer read ONLY their own role's join code.
--
-- Background: role_access_codes stays admin-only at the row level (see the
-- "members read event settings" policy, which blocks that key for non-admins).
-- This function is the one narrow, safe way a ref/judge/emcee can obtain THEIR
-- OWN role's regenerated code without ever being able to read the other roles'
-- codes. It is SECURITY DEFINER (so it can read the admin-only setting) but it
-- filters strictly to the caller's own event_members.role.
create or replace function public.get_my_role_access_code(p_event uuid)
returns table(role text, code text, enabled boolean, updated_at bigint)
language sql
security definer
stable
set search_path = public, extensions
as $$
  with me as (
    select m.role
    from public.event_members m
    where m.event_id = p_event
      and m.user_id = auth.uid()
    limit 1
  ),
  cfg as (
    select value
    from public.event_settings
    where event_id = p_event
      and key = 'role_access_codes'
    limit 1
  )
  select
    me.role,
    (cfg.value -> 'codes' -> me.role ->> 'code')::text,
    coalesce((cfg.value -> 'codes' -> me.role ->> 'enabled')::boolean, false),
    coalesce((cfg.value -> 'codes' -> me.role ->> 'updatedAt')::bigint, 0)
  from me
  left join cfg on true
  where me.role in ('ref', 'judge', 'emcee');
$$;

revoke all on function public.get_my_role_access_code(uuid) from anon;
grant execute on function public.get_my_role_access_code(uuid) to authenticated;

-- Shared settings must participate in Realtime so code/countdown/contact changes
-- reach other devices (idempotent — safe to run repeatedly).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_settings'
  ) then
    alter publication supabase_realtime add table public.event_settings;
  end if;
end $$;
