-- Ref OS Private Beta feedback
-- Run once in Supabase SQL Editor. Safe to re-run.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  type text not null default 'general' check (type in ('bug','suggestion','general')),
  message text not null,
  submitted_by text,
  role text,
  app_version text,
  browser text,
  platform text,
  viewport text,
  display_mode text,
  online boolean,
  language text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_event_created_idx on public.feedback(event_id, created_at desc);
alter table public.feedback enable row level security;

drop policy if exists "members submit feedback" on public.feedback;
drop policy if exists "admins read feedback" on public.feedback;
drop policy if exists "admins delete feedback" on public.feedback;

create policy "members submit feedback" on public.feedback for insert
  with check (public.has_event_role(event_id,array['ref','judge','emcee','admin']));

create policy "admins read feedback" on public.feedback for select
  using (public.has_event_role(event_id,array['admin']));

create policy "admins delete feedback" on public.feedback for delete
  using (public.has_event_role(event_id,array['admin']));
