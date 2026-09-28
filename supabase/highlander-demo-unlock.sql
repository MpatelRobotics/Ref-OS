-- Run only when you intentionally want Highlander matches and violations editable again.
drop trigger if exists highlander_demo_setting_lock on public.event_settings;
update public.event_settings set value = '{"locked":false}'::jsonb, updated_by = 'demo archive unlocked', updated_at = now()
where event_id = '11111111-1111-4111-8111-111111111111' and key = 'highlander_demo_lock';
drop function if exists public.protect_highlander_demo_setting();

drop trigger if exists highlander_demo_matches_lock on public.matches;
drop trigger if exists highlander_demo_alliances_lock on public.alliances;
drop trigger if exists highlander_demo_violations_lock on public.violations;
drop trigger if exists highlander_demo_teams_delete_lock on public.teams;
drop function if exists public.block_highlander_demo_writes();

drop policy if exists "highlander demo violation photos delete lock" on storage.objects;
drop policy if exists "highlander demo violation photos update lock" on storage.objects;
drop function if exists public.is_highlander_violation_photo(text);
