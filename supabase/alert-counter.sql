-- Run once in the Supabase SQL Editor before using the Admin alert counter.
alter table public.push_dispatches add column if not exists push_count integer not null default 0;
alter table public.push_dispatches add column if not exists email_count integer not null default 0;
alter table public.push_dispatches add column if not exists email_failed_count integer not null default 0;

create or replace function public.get_alert_stats(p_event uuid)
returns table (
  requests bigint,
  push_alerts bigint,
  email_alerts bigint,
  failed_emails bigint,
  total_alerts bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication session required';
  end if;

  if not public.has_event_role(p_event, array['admin']) then
    raise exception 'Admin role required';
  end if;

  return query
  select
    count(*)::bigint,
    coalesce(sum(d.push_count), 0)::bigint,
    coalesce(sum(d.email_count), 0)::bigint,
    coalesce(sum(d.email_failed_count), 0)::bigint,
    coalesce(sum(d.sent_count), 0)::bigint
  from public.push_dispatches d
  where d.event_id = p_event;
end;
$$;

revoke all on function public.get_alert_stats(uuid) from public;
grant execute on function public.get_alert_stats(uuid) to authenticated;
