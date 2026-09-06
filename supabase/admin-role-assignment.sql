-- Ref OS: allow an existing Admin to grant or revoke Admin access for a signed in event member.
-- Run this once in the Supabase SQL editor.

create or replace function public.set_event_member_admin(
  p_event uuid,
  p_user uuid,
  p_make_admin boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication session required';
  end if;

  if not public.has_event_role(p_event, array['admin']) then
    raise exception 'Admin role required';
  end if;

  if p_user = auth.uid() and not p_make_admin then
    raise exception 'Use Lock admin access to remove your own Admin role';
  end if;

  if not exists (
    select 1 from public.event_members
    where event_id = p_event and user_id = p_user
  ) then
    raise exception 'Volunteer is not signed in to this event';
  end if;

  update public.event_members
  set role = case when p_make_admin then 'admin' else 'ref' end
  where event_id = p_event and user_id = p_user;
end;
$$;

revoke all on function public.set_event_member_admin(uuid,uuid,boolean) from anon;
grant execute on function public.set_event_member_admin(uuid,uuid,boolean) to authenticated;
