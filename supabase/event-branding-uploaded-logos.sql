-- Expose uploaded event logos to the event selector and login screen.
-- Keeps the existing function signature and exposes only public branding.
-- Safe to rerun; no tables or operational data are changed.

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
      when b.value->>'logoData' ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$'
        and length(b.value->>'logoData') <= 1500000
        then b.value->>'logoData'
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
