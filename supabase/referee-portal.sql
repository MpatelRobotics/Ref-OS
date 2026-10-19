-- Personal referee accounts. Enable Email authentication in Supabase Auth.
-- Profiles and self-reported attendance are private to their owner.
create table if not exists public.referee_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check(length(trim(full_name)) between 1 and 100),
 country text not null default '' check(length(country)<=100),
 region text not null default '' check(length(region)<=100),
 city text not null default '' check(length(city)<=100),
 phone text not null default '' check(length(phone)<=50),
 contact_email text not null default '' check(length(contact_email)<=254),
 discord text not null default '' check(length(discord)<=100)
);
create table if not exists public.referee_event_plans (
 user_id uuid not null references auth.users(id) on delete cascade,
 event_id uuid not null references public.events(id) on delete cascade,
 attendance text not null check(attendance in ('attended','going')),
 primary key(user_id,event_id)
);
alter table public.referee_profiles enable row level security;
alter table public.referee_event_plans enable row level security;
revoke all on public.referee_profiles,public.referee_event_plans from anon,authenticated;
grant select,insert,update,delete on public.referee_profiles,public.referee_event_plans to authenticated;
drop policy if exists referee_profile_owner on public.referee_profiles;
create policy referee_profile_owner on public.referee_profiles for all to authenticated
 using(user_id=auth.uid() and coalesce(auth.jwt()->>'is_anonymous','true')='false')
 with check(user_id=auth.uid() and coalesce(auth.jwt()->>'is_anonymous','true')='false');
drop policy if exists referee_plan_owner on public.referee_event_plans;
create policy referee_plan_owner on public.referee_event_plans for all to authenticated
 using(user_id=auth.uid() and coalesce(auth.jwt()->>'is_anonymous','true')='false')
 with check(user_id=auth.uid() and coalesce(auth.jwt()->>'is_anonymous','true')='false');
