-- Run in the Supabase SQL Editor before showing the Highlander event.
-- Blocks writes from every app version, including an old signed-in browser.
drop trigger if exists highlander_demo_setting_lock on public.event_settings;
insert into public.event_settings (event_id, key, value, updated_by)
values ('11111111-1111-4111-8111-111111111111', 'highlander_demo_lock', '{"locked":true}'::jsonb, 'demo archive')
on conflict (event_id, key) do update
set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();

create or replace function public.protect_highlander_demo_setting()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.event_id = '11111111-1111-4111-8111-111111111111' and new.key = 'highlander_demo_lock' then
      raise exception 'Only the Supabase SQL unlock script can change the Highlander demo lock' using errcode = 'P0001';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if (old.event_id = '11111111-1111-4111-8111-111111111111' and old.key = 'highlander_demo_lock')
       or (new.event_id = '11111111-1111-4111-8111-111111111111' and new.key = 'highlander_demo_lock') then
      raise exception 'Only the Supabase SQL unlock script can change the Highlander demo lock' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if old.event_id = '11111111-1111-4111-8111-111111111111' and old.key = 'highlander_demo_lock' then
    raise exception 'Only the Supabase SQL unlock script can change the Highlander demo lock' using errcode = 'P0001';
  end if;
  return old;
end;
$$;
create trigger highlander_demo_setting_lock
before insert or update or delete on public.event_settings
for each row execute function public.protect_highlander_demo_setting();

create or replace function public.block_highlander_demo_writes()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  protected_event uuid := '11111111-1111-4111-8111-111111111111';
begin
  if tg_op = 'INSERT' then
    if new.event_id = protected_event then
      raise exception 'Highlander Summit demo archive is read only' using errcode = 'P0001';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.event_id = protected_event or new.event_id = protected_event then
      raise exception 'Highlander Summit demo archive is read only' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if old.event_id = protected_event then
    raise exception 'Highlander Summit demo archive is read only' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists highlander_demo_matches_lock on public.matches;
create trigger highlander_demo_matches_lock
before insert or update or delete on public.matches
for each row execute function public.block_highlander_demo_writes();

-- Alliance picks define the saved elimination bracket.
drop trigger if exists highlander_demo_alliances_lock on public.alliances;
create trigger highlander_demo_alliances_lock
before insert or update or delete on public.alliances
for each row execute function public.block_highlander_demo_writes();

drop trigger if exists highlander_demo_violations_lock on public.violations;
create trigger highlander_demo_violations_lock
before insert or update or delete on public.violations
for each row execute function public.block_highlander_demo_writes();

-- The current app deletes a team's violations before deleting its roster row.
-- Keep roster rows too so a demo user cannot hide a team's saved history.
drop trigger if exists highlander_demo_teams_delete_lock on public.teams;
create trigger highlander_demo_teams_delete_lock
before delete on public.teams
for each row execute function public.block_highlander_demo_writes();

-- Older app versions remove violation photos before deleting the database row.
-- Restrictive Storage policies preserve photos already attached to a violation.
create or replace function public.is_highlander_violation_photo(p_path text)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.violations
    where event_id = '11111111-1111-4111-8111-111111111111'
      and photo_paths @> array[p_path]::text[]
  );
$$;
revoke all on function public.is_highlander_violation_photo(text) from public;
grant execute on function public.is_highlander_violation_photo(text) to authenticated;

drop policy if exists "highlander demo violation photos delete lock" on storage.objects;
create policy "highlander demo violation photos delete lock" on storage.objects
as restrictive for delete to authenticated
using (bucket_id <> 'robot-photos' or not public.is_highlander_violation_photo(name));

drop policy if exists "highlander demo violation photos update lock" on storage.objects;
create policy "highlander demo violation photos update lock" on storage.objects
as restrictive for update to authenticated
using (bucket_id <> 'robot-photos' or not public.is_highlander_violation_photo(name))
with check (bucket_id <> 'robot-photos' or not public.is_highlander_violation_photo(name));
