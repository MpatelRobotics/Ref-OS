-- Ref OS demo Admin credential
-- Run once in the Supabase SQL Editor.
-- Demo password: RefOSDemo2026!

insert into public.event_access_credentials(event_id, credential_name, role, credential_hash, enabled)
values(
  '11111111-1111-4111-8111-111111111111',
  'demo_admin_password',
  'admin',
  '4b94b25c629ca56483d4f13227cc81c8806fd69b30ff6479c6e901596576fd02',
  true
)
on conflict(event_id, credential_name)
do update set role=excluded.role, credential_hash=excluded.credential_hash,
              enabled=true, updated_at=now();
