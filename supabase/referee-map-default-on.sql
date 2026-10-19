-- New profiles share their display name and US state by default.
-- Existing saved preferences, including explicit opt-outs, are preserved.
alter table public.referee_profiles alter column map_visible set default true;
