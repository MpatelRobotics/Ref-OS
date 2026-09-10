-- Disable the demo Admin credential after the demo.
update public.event_access_credentials
set enabled=false, updated_at=now()
where event_id='11111111-1111-4111-8111-111111111111'
  and credential_name='demo_admin_password';
