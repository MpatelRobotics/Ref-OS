begin;

alter table public.field_log enable row level security;

drop policy if exists "judges request role code regeneration" on public.field_log;
create policy "judges request role code regeneration"
on public.field_log
for insert
with check (
  public.has_event_role(event_id, array['judge'])
  and kind = 'role_code_request'
);

commit;
