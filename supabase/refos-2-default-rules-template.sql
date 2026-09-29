-- Ref OS 2.0: default rules template for new events.
--
-- Every event created with create_refos_vex_event now starts with its own copy of the
-- default rule library, so referees can use the Rules tab straight away.
--
-- How it works
--   1. refos_rulesets / refos_rule_templates hold named rule libraries (one per game season).
--   2. The first default template is a one-time snapshot of the rules Highlander Summit holds
--      when this file is run. After that, new events never read Highlander's rows.
--   3. create_refos_vex_event copies the default template into the new event in the same
--      transaction as the event itself. No template, no event: creation fails and says why.
--
-- Safe to re-run:
--   - The snapshot is taken only when the ruleset has no template rows yet, so re-running
--     never changes the template or picks up later Highlander edits.
--   - Existing events (Highlander included) are never read for writing, updated, or seeded.
--   - Seeding uses the rules primary key (event_id, code) with ON CONFLICT DO NOTHING, so a
--     repeated seed can never duplicate or overwrite an event's rules.
--
-- Run AFTER schema.sql, seed_rules.sql, refos-2-phase3-create-event.sql, and
-- refos-2-phase7-event-management.sql. If refos-2-phase3-create-event.sql is ever re-run,
-- run this file again afterwards so event creation keeps seeding rules.

begin;

-- ---------------------------------------------------------------------------------------
-- 1. Rulesets and templates (server-side only; no client access)
-- ---------------------------------------------------------------------------------------
create table if not exists public.refos_rulesets (
  key         text primary key,
  label       text not null,
  game        text,
  season      text,
  source      text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
-- At most one default ruleset.
create unique index if not exists refos_rulesets_one_default
  on public.refos_rulesets (is_default) where is_default;

create table if not exists public.refos_rule_templates (
  ruleset     text not null references public.refos_rulesets(key) on delete cascade,
  code        text not null,
  description text,
  category    text,
  ord         int,
  primary key (ruleset, code)
);

alter table public.refos_rulesets enable row level security;
alter table public.refos_rule_templates enable row level security;
-- No policies: only the security-definer seeding function reads these tables.
revoke all on table public.refos_rulesets from public, anon, authenticated;
revoke all on table public.refos_rule_templates from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- 2. First default ruleset: snapshot of Highlander Summit's current rules
-- ---------------------------------------------------------------------------------------
-- Game and season come from the rule library's own labelling in this repository
-- (seed_rules.sql header and the bundled offline rule index: "Override 2026-2027").
insert into public.refos_rulesets (key, label, game, season, source, is_default)
values (
  'v5rc-override-2026-2027',
  'V5RC Override 2026-2027 (Highlander Summit baseline)',
  'V5RC Override',
  '2026-2027',
  'Snapshot of Highlander Summit rules taken when refos-2-default-rules-template.sql was first run',
  true
)
on conflict (key) do nothing;

do $$
declare
  v_highlander constant uuid := '11111111-1111-4111-8111-111111111111';
  v_existing int;
  v_copied int;
begin
  select count(*) into v_existing
    from public.refos_rule_templates where ruleset = 'v5rc-override-2026-2027';

  if v_existing > 0 then
    raise notice 'Default rules template already has % rules; left unchanged.', v_existing;
    return;
  end if;

  -- Read-only copy of rule content. Highlander's rows are not modified.
  insert into public.refos_rule_templates (ruleset, code, description, category, ord)
  select 'v5rc-override-2026-2027', r.code, r.description, r.category, r.ord
    from public.rules r
   where r.event_id = v_highlander;
  get diagnostics v_copied = row_count;

  if v_copied = 0 then
    raise exception 'Highlander Summit has no rules to use as the default template. Run seed_rules.sql first, then run this file again.';
  end if;

  raise notice 'Default rules template created from Highlander Summit: % rules.', v_copied;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- 3. Seed one NEW event from a template (internal helper)
-- ---------------------------------------------------------------------------------------
create or replace function public.seed_refos_event_rules(p_event uuid, p_ruleset text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ruleset public.refos_rulesets%rowtype;
  v_count int;
begin
  if p_event is null then
    raise exception 'An event is required to seed rules.';
  end if;
  if p_event = '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'Highlander Summit rules are never seeded or replaced.';
  end if;

  if p_ruleset is null then
    select * into v_ruleset from public.refos_rulesets where is_default limit 1;
  else
    select * into v_ruleset from public.refos_rulesets where key = p_ruleset;
  end if;
  if v_ruleset.key is null then
    raise exception 'No default rule template is installed. Run refos-2-default-rules-template.sql.';
  end if;

  if not exists (select 1 from public.refos_rule_templates where ruleset = v_ruleset.key) then
    raise exception 'The default rule template "%" is empty.', v_ruleset.label;
  end if;

  -- Only rule content is copied. Favorites, recent rules, notes, and violations are not.
  insert into public.rules (event_id, code, description, category, ord)
  select p_event, t.code, t.description, t.category, t.ord
    from public.refos_rule_templates t
   where t.ruleset = v_ruleset.key
  on conflict (event_id, code) do nothing;
  get diagnostics v_count = row_count;

  -- Record which ruleset this event started from (first seed only).
  insert into public.event_settings (event_id, key, value, updated_by)
  values (
    p_event,
    'rules_template',
    jsonb_build_object('ruleset', v_ruleset.key, 'label', v_ruleset.label,
                       'game', v_ruleset.game, 'season', v_ruleset.season,
                       'rules', v_count, 'seededAt', now()),
    'system'
  )
  on conflict (event_id, key) do nothing;

  return v_count;
end;
$$;

revoke all on function public.seed_refos_event_rules(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- 4. create_refos_vex_event: unchanged behaviour, plus default rules in the same transaction
-- ---------------------------------------------------------------------------------------
create or replace function public.create_refos_vex_event(
  p_name text,
  p_admin_credential text
)
returns setof public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_event public.events%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_code text := upper(trim(coalesce(p_admin_credential, '')));
begin
  if v_user is null then
    raise exception 'You must have an active Ref OS session.';
  end if;

  if length(v_name) < 3 then
    raise exception 'Event name must be at least 3 characters.';
  end if;

  if v_code !~ '^[0-9][A-Z][0-9][0-9]$' then
    raise exception 'Admin access code must use the Ref OS 4 character format.';
  end if;

  insert into public.events(
    name, quals, practice, bracket, finals_best_of, join_code, created_by
  )
  values (
    v_name,
    0,
    0,
    0,
    1,
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    v_user
  )
  returning * into v_event;

  insert into public.event_members(event_id, user_id, role)
  values (v_event.id, v_user, 'admin')
  on conflict (event_id, user_id)
  do update set role = 'admin';

  insert into public.event_access_credentials(
    event_id, credential_name, role, credential_hash, enabled
  )
  values (
    v_event.id,
    'admin_keypad',
    'admin',
    encode(extensions.digest(v_code, 'sha256'::text), 'hex'),
    true
  )
  on conflict (event_id, credential_name)
  do update set
    role = excluded.role,
    credential_hash = excluded.credential_hash,
    enabled = true,
    updated_at = now();

  -- Default rule library, scoped to this new event. If it fails, the whole event is rolled
  -- back and the caller sees the error; no half-configured event is left behind.
  perform public.seed_refos_event_rules(v_event.id);

  return next v_event;
end;
$$;

revoke all on function public.create_refos_vex_event(text, text) from public, anon;
grant execute on function public.create_refos_vex_event(text, text) to authenticated;

commit;

-- Check after running (read only):
--   select key, label, is_default, (select count(*) from public.refos_rule_templates t where t.ruleset = r.key) as rules
--     from public.refos_rulesets r;
