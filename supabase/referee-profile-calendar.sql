-- Run after the referee portal migrations.
alter table public.referee_profiles add column if not exists programs text[] not null default '{}'
 check(programs <@ array['V5RC','VIQRC','VURC']::text[] and cardinality(programs)<=3);
alter table public.referee_profiles add column if not exists languages text[] not null default '{}'
 check(cardinality(languages)<=20 and length(array_to_string(languages,','))<=1200);
alter table public.referee_external_events add column if not exists end_date text not null default '' check(length(end_date)<=40);
create or replace function public.list_referee_event_dates()
returns table(event_id uuid,start_date text,end_date text) language sql stable security definer set search_path=public as $$
 select e.id,left(coalesce(s.value->>'start',''),40),left(coalesce(s.value->>'end',''),40)
 from public.events e left join public.event_settings s on s.event_id=e.id and s.key='vex_event';
$$;
revoke all on function public.list_referee_event_dates() from public,anon;
grant execute on function public.list_referee_event_dates() to authenticated;
