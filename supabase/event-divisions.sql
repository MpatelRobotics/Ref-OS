-- Run after refos-2-league-events.sql. Existing schedules remain in division 0.
-- Deploy this migration and the division-aware client together.
begin;
alter table public.matches add column if not exists division_id integer not null default 0;
do $$
declare existing_pk text;
begin
 select conname into existing_pk from pg_constraint where conrelid='public.matches'::regclass and contype='p';
 if existing_pk is not null then execute format('alter table public.matches drop constraint %I',existing_pk); end if;
end $$;
alter table public.matches add constraint matches_pkey primary key(event_id,session_key,division_id,phase,num);
commit;
