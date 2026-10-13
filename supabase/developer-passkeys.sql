-- Run after refos-2-developer-access.sql. Only the Edge Function may access these tables.
begin;
create table if not exists public.developer_passkeys (
 id text primary key,
 public_key text not null,
 counter bigint not null default 0,
 transports jsonb not null default '[]',
 secret_version text not null,
 rp_id text not null,
 created_at timestamptz not null default now()
);
create table if not exists public.developer_passkey_challenges (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 event_id uuid not null references public.events(id) on delete cascade,
 kind text not null check(kind in ('register','authenticate')),
 challenge text not null,
 secret_version text not null,
 expires_at timestamptz not null default now() + interval '5 minutes'
);
alter table public.developer_passkeys enable row level security;
alter table public.developer_passkey_challenges enable row level security;
revoke all on public.developer_passkeys, public.developer_passkey_challenges from public,anon,authenticated;
grant all on public.developer_passkeys, public.developer_passkey_challenges to service_role;
create or replace function public.consume_developer_passkey_challenge(p_id uuid,p_user uuid)
returns setof public.developer_passkey_challenges language sql security definer set search_path=public as $$
 delete from public.developer_passkey_challenges where id=p_id and user_id=p_user and expires_at>now() returning *;
$$;
revoke all on function public.consume_developer_passkey_challenge(uuid,uuid) from public,anon,authenticated;
grant execute on function public.consume_developer_passkey_challenge(uuid,uuid) to service_role;
commit;
