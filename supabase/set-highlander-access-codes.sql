-- Run once in the Supabase SQL editor for the Highlander Summit event.
-- These are permanent backup credentials. Normal generated role credentials
-- remain enabled and continue to be managed by the app.

begin;

insert into public.event_access_credentials
  (event_id, credential_name, role, credential_hash, enabled)
values
  ('11111111-1111-4111-8111-111111111111', 'backup_admin_code', 'admin', '06ac1ae5a70d54a1f7461100f96a7faf3ccd98ec739868e274068b74e560516d', true),
  ('11111111-1111-4111-8111-111111111111', 'backup_ref_code', 'ref', '3604e01cd7f166aa7ba8171221bde0eb81321ec900d48b0ecf2bba329510adde', true),
  ('11111111-1111-4111-8111-111111111111', 'backup_judge_code', 'judge', 'acd804081f67a9f6983f69ea4da5c06bfa3823656e69da802192a75d9ad84d8e', true),
  ('11111111-1111-4111-8111-111111111111', 'backup_emcee_code', 'emcee', '5e0fc5e08d28ab37563e350a422f37dcc6272e8c1d2490bbec12df19619a8a5f', true)
on conflict (event_id, credential_name)
do update set
  role = excluded.role,
  credential_hash = excluded.credential_hash,
  enabled = true,
  updated_at = now();

commit;
