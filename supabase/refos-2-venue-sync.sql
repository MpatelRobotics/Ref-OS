-- Ref OS 2.0: Local Venue Server (Phase 1) — per-event venue sync key.
--
-- A Ref OS Venue Server only accepts data for an event from devices that present that event's
-- venue sync key. The key is issued here, by Supabase, ONLY to devices that are signed in to the
-- event (any event role). The venue server itself never sees access codes, the Developer
-- credential, or Supabase secrets; it stores only a SHA-256 hash of this key.
--
-- Safe to re-run. Run after schema.sql and refos-2-phase7-event-management.sql.

begin;

create table if not exists public.refos_venue_sync_keys (
  event_id   uuid primary key references public.events(id) on delete cascade,
  sync_key   text not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);
alter table public.refos_venue_sync_keys enable row level security;
-- No policies: only the functions below read or write this table.
revoke all on table public.refos_venue_sync_keys from public, anon, authenticated;

-- Returns this event's venue sync key to a signed-in member of the event (creating it once).
create or replace function public.get_venue_sync_key(p_event uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.event_members m where m.event_id = p_event and m.user_id = auth.uid()) then
    raise exception 'Event sign-in required' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.events e where e.id = p_event and e.archived_at is not null) then
    raise exception 'This event has been archived' using errcode = 'P0001';
  end if;

  insert into public.refos_venue_sync_keys(event_id, sync_key)
  values (p_event, encode(extensions.gen_random_bytes(32), 'hex'))
  on conflict (event_id) do nothing;

  select k.sync_key into v_key from public.refos_venue_sync_keys k where k.event_id = p_event;
  return v_key;
end;
$$;

revoke all on function public.get_venue_sync_key(uuid) from public, anon;
grant execute on function public.get_venue_sync_key(uuid) to authenticated;

-- Admin-only key rotation (e.g. after a device with the key is lost). After rotating, unpair the
-- event on the venue server (node server.mjs --forget-event <id>) and let devices pair again.
create or replace function public.rotate_venue_sync_key(p_event uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_event_role(p_event, array['admin']) then
    raise exception 'Admin role required' using errcode = 'P0001';
  end if;
  insert into public.refos_venue_sync_keys(event_id, sync_key)
  values (p_event, encode(extensions.gen_random_bytes(32), 'hex'))
  on conflict (event_id) do update set sync_key = excluded.sync_key, rotated_at = now();
end;
$$;

revoke all on function public.rotate_venue_sync_key(uuid) from public, anon;
grant execute on function public.rotate_venue_sync_key(uuid) to authenticated;

commit;
