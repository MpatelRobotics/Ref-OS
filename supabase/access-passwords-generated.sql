-- Generated locally by scripts/generate-access-security-sql.mjs
-- Password plaintext is NOT included in this output.

insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
values('11111111-1111-4111-8111-111111111111','site_password','ref','9db811e6fc75439add2c0c83f670aed39734b9847f51f24d99d67e12950e6f2e',true)
on conflict(event_id,credential_name)
do update set role=excluded.role,credential_hash=excluded.credential_hash,enabled=true,updated_at=now();

insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
values('11111111-1111-4111-8111-111111111111','judge_password','judge','fad4b8d1b7f049ad70ae5a3e8094df1811ab435cfdac573007c2e53d016f3251',true)
on conflict(event_id,credential_name)
do update set role=excluded.role,credential_hash=excluded.credential_hash,enabled=true,updated_at=now();

insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
values('11111111-1111-4111-8111-111111111111','emcee_password','emcee','1bd9711a2782360e3585029a41f16cf340b3dbcf71e053a9010e87da6a44e07c',true)
on conflict(event_id,credential_name)
do update set role=excluded.role,credential_hash=excluded.credential_hash,enabled=true,updated_at=now();

insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
values('11111111-1111-4111-8111-111111111111','admin_password','admin','41575f29b33d019af20da3d26302ae757b5bd35385441bfa798b6ff5d4f9df07',true)
on conflict(event_id,credential_name)
do update set role=excluded.role,credential_hash=excluded.credential_hash,enabled=true,updated_at=now();
