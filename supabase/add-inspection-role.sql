-- Adds the restricted Inspection role and its permanent backup credential.
-- Inspection users can read the event, teams, and rules, and can upload robot
-- pictures. They cannot read matches, violations, judging, or administration.

begin;

alter table public.event_access_credentials
  drop constraint if exists event_access_credentials_role_check;
alter table public.event_access_credentials
  add constraint event_access_credentials_role_check
  check (role in ('ref','judge','emcee','inspection','admin'));

insert into public.event_access_credentials
  (event_id, credential_name, role, credential_hash, enabled)
values
  ('11111111-1111-4111-8111-111111111111', 'backup_inspection_code', 'inspection', '507387d041d89ad1b99cfd2f292a2e758d884971d0a95d72d94c573eed734738', true)
on conflict (event_id, credential_name)
do update set
  role = excluded.role,
  credential_hash = excluded.credential_hash,
  enabled = true,
  updated_at = now();

drop policy if exists "members read events" on public.events;
create policy "members read events" on public.events for select
  using (public.has_event_role(id,array['ref','judge','emcee','inspection','admin']));

drop policy if exists "members read teams" on public.teams;
create policy "members read teams" on public.teams for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','inspection','admin']));

drop policy if exists "members read rules" on public.rules;
create policy "members read rules" on public.rules for select
  using (public.has_event_role(event_id,array['ref','judge','emcee','inspection','admin']));

drop policy if exists "members read photos" on storage.objects;
create policy "members read photos" on storage.objects for select
using (
  bucket_id='robot-photos'
  and public.has_event_role((storage.foldername(name))[1]::uuid,array['ref','judge','emcee','inspection','admin'])
);

drop policy if exists "members upload photos" on storage.objects;
create policy "members upload photos" on storage.objects for insert
with check (
  bucket_id='robot-photos'
  and public.has_event_role((storage.foldername(name))[1]::uuid,array['ref','inspection','admin'])
);

create or replace function public.append_team_photo_path(p_event uuid, p_team text, p_path text)
returns text[]
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_paths text[];
  v_prefix text;
begin
  if not public.has_event_role(p_event,array['ref','inspection','admin']) then
    raise exception 'Robot photo access required';
  end if;
  v_prefix := p_event::text || '/team/' || upper(trim(p_team)) || '/';
  if position(v_prefix in p_path) <> 1 then
    raise exception 'Invalid robot photo path';
  end if;
  update public.teams
  set photo_paths = case
    when p_path = any(coalesce(photo_paths,'{}'::text[])) then coalesce(photo_paths,'{}'::text[])
    else array_append(coalesce(photo_paths,'{}'::text[]),p_path)
  end
  where event_id=p_event and number=upper(trim(p_team))
  returning photo_paths into v_paths;
  if v_paths is null then raise exception 'Team not found'; end if;
  return v_paths;
end;
$$;

revoke all on function public.append_team_photo_path(uuid,text,text) from public, anon;
grant execute on function public.append_team_photo_path(uuid,text,text) to authenticated;

commit;
