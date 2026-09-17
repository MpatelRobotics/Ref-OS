-- Ref OS all role push alerts and Judge Advisor help requests
-- Run once in the Supabase SQL Editor after push-notifications.sql.

alter table public.push_subscriptions enable row level security;

drop policy if exists "admins read own push subscriptions" on public.push_subscriptions;
drop policy if exists "admins create own push subscriptions" on public.push_subscriptions;
drop policy if exists "admins update own push subscriptions" on public.push_subscriptions;
drop policy if exists "admins delete own push subscriptions" on public.push_subscriptions;
drop policy if exists "members read own push subscriptions" on public.push_subscriptions;
drop policy if exists "members create own push subscriptions" on public.push_subscriptions;
drop policy if exists "members update own push subscriptions" on public.push_subscriptions;
drop policy if exists "members delete own push subscriptions" on public.push_subscriptions;

create policy "members read own push subscriptions" on public.push_subscriptions for select
  using (auth.uid() = user_id and public.has_event_role(event_id, array['ref','judge','emcee','admin']));
create policy "members create own push subscriptions" on public.push_subscriptions for insert
  with check (auth.uid() = user_id and public.has_event_role(event_id, array['ref','judge','emcee','admin']));
create policy "members update own push subscriptions" on public.push_subscriptions for update
  using (auth.uid() = user_id and public.has_event_role(event_id, array['ref','judge','emcee','admin']))
  with check (auth.uid() = user_id and public.has_event_role(event_id, array['ref','judge','emcee','admin']));
create policy "members delete own push subscriptions" on public.push_subscriptions for delete
  using (auth.uid() = user_id and public.has_event_role(event_id, array['ref','judge','emcee','admin']));

drop policy if exists "judges request role code regeneration" on public.field_log;
create policy "judges request role code regeneration" on public.field_log for insert
  with check (public.has_event_role(event_id,array['judge']) and kind in ('role_code_request','help_request'));
