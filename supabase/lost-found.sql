-- Run after the base schema and event role migrations. Event-wide board.
begin;
create table if not exists public.lost_found_items (
 id uuid primary key,
 event_id uuid not null references public.events(id) on delete cascade,
 description text not null check(length(trim(description)) between 1 and 1000),
 pickup_location text not null check(length(trim(pickup_location)) between 1 and 200),
 photo_path text,
 created_by uuid not null references auth.users(id),
 logged_by text not null default '',
 returned boolean not null default false,
 created_at timestamptz not null default now(),
 check(photo_path is null or photo_path in (event_id::text || '/' || created_by::text || '/' || id::text || '.jpg',event_id::text || '/' || created_by::text || '/' || id::text || '.webp'))
);
create index if not exists lost_found_event_idx on public.lost_found_items(event_id,created_at desc);
alter table public.lost_found_items enable row level security;
revoke all on public.lost_found_items from anon,authenticated;
grant select,insert on public.lost_found_items to authenticated;
grant update(returned) on public.lost_found_items to authenticated;
drop policy if exists "lost found read" on public.lost_found_items;
create policy "lost found read" on public.lost_found_items for select to authenticated using(public.has_event_role(event_id,array['admin','ref','judge','emcee','inspection']));
drop policy if exists "lost found add" on public.lost_found_items;
create policy "lost found add" on public.lost_found_items for insert to authenticated with check(created_by=auth.uid() and returned=false and public.has_event_role(event_id,array['admin','ref','judge','emcee','inspection']));
drop policy if exists "lost found status" on public.lost_found_items;
create policy "lost found status" on public.lost_found_items for update to authenticated using(public.has_event_role(event_id,array['admin'])) with check(public.has_event_role(event_id,array['admin']));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('lost-found-photos','lost-found-photos',false,10485760,array['image/jpeg','image/webp']) on conflict(id) do nothing;
create or replace function public.lost_found_photo_access(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.events e where e.id::text=split_part(p_path,'/',1) and public.has_event_role(e.id,array['admin','ref','judge','emcee','inspection']));
$$;
revoke all on function public.lost_found_photo_access(text) from public,anon;
grant execute on function public.lost_found_photo_access(text) to authenticated;
drop policy if exists "lost found photo read" on storage.objects;
create policy "lost found photo read" on storage.objects for select to authenticated using(bucket_id='lost-found-photos' and public.lost_found_photo_access(name));
drop policy if exists "lost found photo add" on storage.objects;
create policy "lost found photo add" on storage.objects for insert to authenticated with check(bucket_id='lost-found-photos' and split_part(name,'/',2)=auth.uid()::text and public.lost_found_photo_access(name));
drop policy if exists "lost found photo retry" on storage.objects;
create policy "lost found photo retry" on storage.objects for update to authenticated using(bucket_id='lost-found-photos' and split_part(name,'/',2)=auth.uid()::text and public.lost_found_photo_access(name)) with check(bucket_id='lost-found-photos' and split_part(name,'/',2)=auth.uid()::text and public.lost_found_photo_access(name));
commit;
