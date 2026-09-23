-- Run once in the Supabase SQL Editor before deploying this app version.
-- A reset changes the generation and clears team references in one transaction.
-- Older queued pictures cannot append themselves after a reset.
begin;

create or replace function public.robot_photo_generation(p_event uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_generation text;
begin
  if not public.has_event_role(p_event, array['ref','inspection','admin']) then
    raise exception 'Robot photo access required';
  end if;
  select value->>'version' into v_generation from public.event_settings
  where event_id = p_event and key = 'robot_photo_generation';
  return coalesce(v_generation, '0');
end;
$$;

create or replace function public.append_team_photo_path(p_event uuid, p_team text, p_path text, p_generation text)
returns text[] language plpgsql security definer set search_path = public, extensions as $$
declare v_paths text[]; v_current text;
begin
  if not public.has_event_role(p_event, array['ref','inspection','admin']) then
    raise exception 'Robot photo access required';
  end if;
  if position(p_event::text || '/team/' || upper(trim(p_team)) || '/' in p_path) <> 1 then
    raise exception 'Invalid robot photo path';
  end if;
  -- Lock the generation row, serializing the append against a reset.
  select value->>'version' into v_current from public.event_settings
  where event_id = p_event and key = 'robot_photo_generation' for update;
  if coalesce(v_current, '0') <> coalesce(p_generation, '0') then
    raise exception 'Robot picture was captured before the latest reset';
  end if;
  update public.teams set photo_paths = case
    when p_path = any(coalesce(photo_paths, '{}'::text[])) then coalesce(photo_paths, '{}'::text[])
    else array_append(coalesce(photo_paths, '{}'::text[]), p_path)
  end where event_id = p_event and number = upper(trim(p_team)) returning photo_paths into v_paths;
  if v_paths is null then raise exception 'Team not found'; end if;
  return v_paths;
end;
$$;

-- The old three argument function cannot check the reset generation.
drop function if exists public.append_team_photo_path(uuid,text,text);

create or replace function public.remove_team_photo_path(p_event uuid, p_team text, p_path text)
returns text[] language plpgsql security definer set search_path = public, extensions as $$
declare v_paths text[];
begin
  if not public.has_event_role(p_event, array['ref','inspection','admin']) then
    raise exception 'Robot photo access required';
  end if;
  if position(p_event::text || '/team/' || upper(trim(p_team)) || '/' in p_path) <> 1 then
    raise exception 'Invalid robot photo path';
  end if;
  update public.teams set photo_paths=array_remove(coalesce(photo_paths,'{}'::text[]),p_path)
  where event_id=p_event and number=upper(trim(p_team)) returning photo_paths into v_paths;
  return coalesce(v_paths,'{}'::text[]);
end;
$$;

create or replace function public.reset_event_robot_photos(p_event uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_version text := gen_random_uuid()::text; v_paths text[]; v_previous text[];
begin
  if not public.has_event_role(p_event, array['admin']) then
    raise exception 'Admin access required';
  end if;
  insert into public.event_settings(event_id,key,value,updated_at)
  values(p_event,'robot_photo_generation',jsonb_build_object('version',v_version),now())
  on conflict(event_id,key) do update set value=excluded.value,updated_at=now();
  select coalesce(array_agg(distinct u.path), '{}'::text[]) into v_paths
  from public.teams t cross join lateral unnest(coalesce(t.photo_paths,'{}'::text[])) as u(path)
  where t.event_id = p_event;
  select coalesce(array_agg(p.path), '{}'::text[]) into v_previous
  from public.event_settings s cross join lateral jsonb_array_elements_text(coalesce(s.value->'paths','[]'::jsonb)) as p(path)
  where s.event_id=p_event and s.key='robot_photo_cleanup';
  select coalesce(array_agg(distinct u.path), '{}'::text[]) into v_paths
  from unnest(v_paths || v_previous) as u(path);
  update public.teams set photo_paths='{}'::text[] where event_id=p_event;
  insert into public.event_settings(event_id,key,value,updated_at)
  values(p_event,'robot_photo_cleanup',jsonb_build_object('version',v_version,'paths',v_paths),now())
  on conflict(event_id,key) do update set value=excluded.value,updated_at=now();
  return jsonb_build_object('version',v_version,'paths',v_paths);
end;
$$;

create or replace function public.finish_robot_photo_cleanup(p_event uuid, p_version text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.has_event_role(p_event, array['admin']) then
    raise exception 'Admin access required';
  end if;
  delete from public.event_settings where event_id=p_event and key='robot_photo_cleanup'
    and value->>'version'=p_version;
end;
$$;

revoke all on function public.robot_photo_generation(uuid) from public, anon;
revoke all on function public.append_team_photo_path(uuid,text,text,text) from public, anon;
revoke all on function public.remove_team_photo_path(uuid,text,text) from public, anon;
revoke all on function public.reset_event_robot_photos(uuid) from public, anon;
revoke all on function public.finish_robot_photo_cleanup(uuid,text) from public, anon;
grant execute on function public.robot_photo_generation(uuid) to authenticated;
grant execute on function public.append_team_photo_path(uuid,text,text,text) to authenticated;
grant execute on function public.remove_team_photo_path(uuid,text,text) to authenticated;
grant execute on function public.reset_event_robot_photos(uuid) to authenticated;
grant execute on function public.finish_robot_photo_cleanup(uuid,text) to authenticated;

-- An inspector can clean up an upload rejected by a concurrent reset.
drop policy if exists "inspectors delete own robot uploads" on storage.objects;
create policy "inspectors delete own robot uploads" on storage.objects for delete using (
  bucket_id='robot-photos'
  and owner_id=auth.uid()::text
  and public.has_event_role((storage.foldername(name))[1]::uuid,array['inspection'])
);
commit;
