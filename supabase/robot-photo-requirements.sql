-- Run after the base schema and event-settings migration. Writes use existing Admin-only settings RLS.
create or replace function public.get_event_robot_photo_requirements(p_event uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce((select s.value from public.event_settings s where s.event_id=p_event and s.key='robot_photo_requirements'),
 '{"required":["front","side","back","tag"]}'::jsonb)
 where public.has_event_role(p_event,array['admin','ref','judge','emcee','inspection']);
$$;
revoke all on function public.get_event_robot_photo_requirements(uuid) from public,anon;
grant execute on function public.get_event_robot_photo_requirements(uuid) to authenticated;
