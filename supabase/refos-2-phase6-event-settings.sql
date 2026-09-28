-- Ref OS 2.0 Phase 6: Per Event Branding & Settings
--
-- Phase 6 does NOT add tables or columns. Settings reuse existing storage:
--   events.name                          event display name (admins already have update rights)
--   event_settings key 'event_branding'  { shortName, logoUrl, accent }
--   event_settings key 'field_names'     { "Field 1": ..., "Field 2": ..., "Field 3": ... }
--
-- event_settings is readable only by signed-in event members, but the Choose VEX Event
-- screen and the login screen run before a device has claimed an event role. This function
-- exposes ONLY the public branding values those screens need. It does not expose access
-- credentials, credential hashes, members, role codes, or any other event data or setting.
--
-- Read only. Writes nothing and does not touch Highlander or any operational data.
-- Safe to rerun.

create or replace function public.list_refos_event_branding()
returns table(
  event_id uuid,
  event_name text,
  short_name text,
  logo_url text,
  accent_color text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.name,
    nullif(left(trim(coalesce(b.value->>'shortName', '')), 60), ''),
    case
      when b.value->>'logoUrl' ~* '^https?://[^[:space:]]+$' and length(b.value->>'logoUrl') <= 2000
        then b.value->>'logoUrl'
    end,
    case
      when b.value->>'accent' ~ '^#[0-9A-Fa-f]{6}$' then upper(b.value->>'accent')
    end
  from public.events e
  left join public.event_settings b
    on b.event_id = e.id
   and b.key = 'event_branding'
  order by e.created_at desc, e.name asc;
$$;

revoke all on function public.list_refos_event_branding() from public;
grant execute on function public.list_refos_event_branding() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Field display names for every event role.
--
-- The event_settings read policy covers Referee, Judge Advisor, Emcee, and Admin, but not
-- Inspection, so Inspection devices showed the default Field 1 / Field 2 / Field 3 names.
-- Rather than widening that policy (which would expose every event setting to Inspection),
-- this function returns ONLY the three field display names from the existing 'field_names'
-- setting, and only to a signed-in member of that same event.
--
-- Read only: it cannot change Event Settings. Editing stays Admin-only through the existing
-- "admins write event settings" policy. It exposes no credentials and no other settings.
-- Safe to rerun.
-- ---------------------------------------------------------------------------

create or replace function public.get_event_field_names(p_event uuid)
returns table(
  field_names jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    jsonb_strip_nulls(jsonb_build_object(
      'Field 1', nullif(left(trim(coalesce(s.value->>'Field 1', '')), 40), ''),
      'Field 2', nullif(left(trim(coalesce(s.value->>'Field 2', '')), 40), ''),
      'Field 3', nullif(left(trim(coalesce(s.value->>'Field 3', '')), 40), '')
    )),
    s.updated_at
  from public.event_settings s
  where s.event_id = p_event
    and s.key = 'field_names'
    and public.has_event_role(p_event, array['ref','judge','emcee','inspection','admin']);
$$;

revoke all on function public.get_event_field_names(uuid) from public, anon;
grant execute on function public.get_event_field_names(uuid) to authenticated;
