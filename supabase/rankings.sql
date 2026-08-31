-- Run this once on an existing Ref-OS Supabase project to enable uploaded team rankings.
alter table public.teams add column if not exists rank int;
