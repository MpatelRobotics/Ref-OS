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
