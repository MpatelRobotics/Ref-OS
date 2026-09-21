-- Ref OS event volunteer web push subscriptions
-- Run this file once in the Supabase SQL Editor.

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_event_idx on public.push_subscriptions(event_id);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "admins read own push subscriptions" on public.push_subscriptions;
drop policy if exists "members read own push subscriptions" on public.push_subscriptions;
create policy "members read own push subscriptions" on public.push_subscriptions for select
  using (auth.uid() = user_id and public.has_event_role(event_id, array['ref','judge','emcee','admin']));

drop policy if exists "admins create own push subscriptions" on public.push_subscriptions;
drop policy if exists "members create own push subscriptions" on public.push_subscriptions;
create policy "members create own push subscriptions" on public.push_subscriptions for insert
  with check (auth.uid() = user_id and public.has_event_role(event_id, array['ref','judge','emcee','admin']));

drop policy if exists "admins update own push subscriptions" on public.push_subscriptions;
drop policy if exists "members update own push subscriptions" on public.push_subscriptions;
create policy "members update own push subscriptions" on public.push_subscriptions for update
  using (auth.uid() = user_id and public.has_event_role(event_id, array['ref','judge','emcee','admin']))
  with check (auth.uid() = user_id and public.has_event_role(event_id, array['ref','judge','emcee','admin']));

drop policy if exists "admins delete own push subscriptions" on public.push_subscriptions;
drop policy if exists "members delete own push subscriptions" on public.push_subscriptions;
create policy "members delete own push subscriptions" on public.push_subscriptions for delete
  using (auth.uid() = user_id and public.has_event_role(event_id, array['ref','judge','emcee','admin']));

create table if not exists public.push_dispatches (
  request_id uuid primary key references public.field_log(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  sent_count integer not null default 0,
  push_count integer not null default 0,
  email_count integer not null default 0,
  email_failed_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.push_dispatches add column if not exists push_count integer not null default 0;
alter table public.push_dispatches add column if not exists email_count integer not null default 0;
alter table public.push_dispatches add column if not exists email_failed_count integer not null default 0;

alter table public.push_dispatches enable row level security;
-- No browser policies. Only the Edge Function service role can access dispatch records.
