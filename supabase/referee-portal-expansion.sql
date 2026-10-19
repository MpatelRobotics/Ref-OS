-- Run after the referee portal, community, and profile/calendar migrations.
alter table public.referee_profiles add column if not exists photo_path text not null default ''
 check(photo_path='' or split_part(photo_path,'/',1)=user_id::text);
create table if not exists public.referee_bookmarks (
 user_id uuid not null references auth.users(id) on delete cascade,
 event_key text not null check(length(event_key) between 1 and 100),
 event_id uuid references public.events(id) on delete set null,
 code text not null default '',name text not null check(length(name) between 1 and 250),
 location text not null default '',start_date text not null default '',end_date text not null default '',
 program text not null default '',event_type text not null default '',
 primary key(user_id,event_key)
);
alter table public.referee_bookmarks enable row level security;
revoke all on public.referee_bookmarks from public,anon,authenticated;
grant select,insert,update,delete on public.referee_bookmarks to authenticated;
drop policy if exists referee_bookmark_owner on public.referee_bookmarks;
create policy referee_bookmark_owner on public.referee_bookmarks for all to authenticated
 using(user_id=auth.uid() and coalesce(auth.jwt()->>'is_anonymous','true')='false')
 with check(user_id=auth.uid() and coalesce(auth.jwt()->>'is_anonymous','true')='false');

create table if not exists public.referee_invitations (
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id) on delete cascade,
 recipient_email text not null check(length(recipient_email)<=254),invited_by uuid not null references auth.users(id),
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default now(),responded_at timestamptz,
 unique(event_id,recipient_email)
);
alter table public.referee_invitations enable row level security;
revoke all on public.referee_invitations from public,anon,authenticated;
create or replace function public.list_referee_invite_events()
returns table(id uuid,name text) language sql stable security definer set search_path=public as $$
 select e.id,e.name from public.events e join public.event_members m on m.event_id=e.id
 where m.user_id=auth.uid() and m.role='admin' and e.archived_at is null order by e.name;
$$;
create or replace function public.invite_referee(p_event uuid,p_email text)
returns void language plpgsql security definer set search_path=public as $$
declare v_email text:=lower(trim(p_email));
begin
 if auth.uid() is null or not exists(select 1 from public.event_members where event_id=p_event and user_id=auth.uid() and role='admin') then raise exception 'Event Admin access required';end if;
 if not exists(select 1 from public.events where id=p_event and archived_at is null) then raise exception 'Event is archived or unavailable';end if;
 if v_email is null or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid referee account email';end if;
 perform pg_advisory_xact_lock(hashtext('referee-invite'),hashtext(auth.uid()::text));
 if (select count(*) from public.referee_invitations where invited_by=auth.uid() and created_at>now()-interval '1 hour')>=100 then raise exception 'Invitation limit reached. Try again later.';end if;
 insert into public.referee_invitations(event_id,recipient_email,invited_by) values(p_event,v_email,auth.uid())
 on conflict(event_id,recipient_email) do update set status='pending',invited_by=excluded.invited_by,created_at=now(),responded_at=null
 where referee_invitations.status in ('declined','cancelled');
end;$$;
create or replace function public.list_my_referee_invitations()
returns table(id uuid,event_id uuid,event_name text,status text,created_at timestamptz,archived boolean)
language plpgsql stable security definer set search_path=public as $$
begin
 if coalesce(auth.jwt()->>'is_anonymous','true')<>'false' then raise exception 'Referee account required';end if;
 return query select i.id,i.event_id,e.name,i.status,i.created_at,e.archived_at is not null from public.referee_invitations i join public.events e on e.id=i.event_id
 where i.recipient_email=lower(auth.jwt()->>'email') order by i.created_at desc;
end;$$;
create or replace function public.list_sent_referee_invitations(p_event uuid)
returns table(id uuid,recipient_email text,status text,created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
 if not exists(select 1 from public.event_members where event_id=p_event and user_id=auth.uid() and role='admin') then raise exception 'Event Admin access required';end if;
 return query select i.id,i.recipient_email,i.status,i.created_at from public.referee_invitations i where i.event_id=p_event order by i.created_at desc;
end;$$;
create or replace function public.respond_referee_invitation(p_invitation uuid,p_accept boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_invite public.referee_invitations%rowtype;
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','true')<>'false' then raise exception 'Referee account required';end if;
 select * into v_invite from public.referee_invitations where id=p_invitation for update;
 if not found or v_invite.recipient_email<>lower(coalesce(auth.jwt()->>'email','')) then raise exception 'Invitation not found';end if;
 if v_invite.status<>'pending' then raise exception 'This invitation has already been answered';end if;
 if p_accept is null then raise exception 'Choose accept or decline';end if;
 if p_accept then
  if not exists(select 1 from public.events where id=v_invite.event_id and archived_at is null) then raise exception 'This event is archived';end if;
  insert into public.event_members(event_id,user_id,role,name) values(v_invite.event_id,auth.uid(),'ref',coalesce((select full_name from public.referee_profiles where user_id=auth.uid()),'Referee')) on conflict(event_id,user_id) do nothing;
  insert into public.referee_event_plans values(auth.uid(),v_invite.event_id,'going') on conflict(user_id,event_id) do update set attendance='going';
 end if;
 update public.referee_invitations set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now() where referee_invitations.id=p_invitation;
 return v_invite.event_id;
end;$$;
revoke all on function public.list_referee_invite_events(),public.invite_referee(uuid,text),public.list_my_referee_invitations(),public.list_sent_referee_invitations(uuid),public.respond_referee_invitation(uuid,boolean) from public,anon;
grant execute on function public.list_referee_invite_events(),public.invite_referee(uuid,text),public.list_my_referee_invitations(),public.list_sent_referee_invitations(uuid),public.respond_referee_invitation(uuid,boolean) to authenticated;

-- Private screenshots, readable only by the sender and verified Developers.
create table if not exists public.referee_feedback_attachments (
 feedback_id uuid not null references public.referee_portal_feedback(id) on delete cascade,
 slot int not null check(slot between 0 and 2),path text not null unique,
 primary key(feedback_id,slot)
);
alter table public.referee_feedback_attachments enable row level security;
revoke all on public.referee_feedback_attachments from public,anon,authenticated;
grant select on public.referee_feedback_attachments to authenticated;
-- Helper avoids exposing feedback rows to storage policies or depending on their RLS.
create or replace function public.can_read_referee_feedback(p_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.referee_portal_feedback where id=p_id and user_id=auth.uid()) or exists(select 1 from public.event_members where user_id=auth.uid() and role='admin' and developer=true);
$$;
drop policy if exists referee_feedback_attachment_read on public.referee_feedback_attachments;
create policy referee_feedback_attachment_read on public.referee_feedback_attachments for select to authenticated using(public.can_read_referee_feedback(feedback_id));
create or replace function public.register_referee_feedback_screenshot(p_id uuid,p_slot int,p_path text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.referee_portal_feedback where id=p_id and user_id=auth.uid()) then raise exception 'Feedback not found';end if;
 if p_slot not between 0 and 2 or p_path !~ ('^'||auth.uid()::text||'/'||p_id::text||'/'||p_slot::text||'\.(webp|jpg)$') then raise exception 'Invalid screenshot path';end if;
 if not exists(select 1 from storage.objects where bucket_id='referee-feedback-screenshots' and name=p_path) then raise exception 'Upload the screenshot before attaching it';end if;
 insert into public.referee_feedback_attachments values(p_id,p_slot,p_path) on conflict(feedback_id,slot) do nothing;
end;$$;
create or replace function public.list_my_referee_feedback()
returns table(id uuid,note text,created_at timestamptz,status text) language sql stable security definer set search_path=public as $$
 select f.id,f.note,f.created_at,f.status from public.referee_portal_feedback f where f.user_id=auth.uid() order by f.created_at desc;
$$;
revoke all on function public.can_read_referee_feedback(uuid),public.register_referee_feedback_screenshot(uuid,int,text),public.list_my_referee_feedback() from public,anon;
grant execute on function public.can_read_referee_feedback(uuid),public.register_referee_feedback_screenshot(uuid,int,text),public.list_my_referee_feedback() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('referee-profile-photos','referee-profile-photos',false,1572864,array['image/jpeg','image/webp']),
 ('referee-feedback-screenshots','referee-feedback-screenshots',false,1572864,array['image/jpeg','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists referee_profile_photo_owner on storage.objects;
create policy referee_profile_photo_owner on storage.objects for all to authenticated
 using(bucket_id='referee-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text)
 with check(bucket_id='referee-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text and coalesce(auth.jwt()->>'is_anonymous','true')='false');
-- Use a definer helper because feedback rows are intentionally not directly readable.
create or replace function public.owns_referee_feedback_path(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
 select split_part(p_path,'/',1)=auth.uid()::text and exists(select 1 from public.referee_portal_feedback where id::text=split_part(p_path,'/',2) and user_id=auth.uid());
$$;
revoke all on function public.owns_referee_feedback_path(text) from public,anon;
grant execute on function public.owns_referee_feedback_path(text) to authenticated;
drop policy if exists referee_screenshot_upload on storage.objects;
create policy referee_screenshot_upload on storage.objects for insert to authenticated with check(bucket_id='referee-feedback-screenshots' and public.owns_referee_feedback_path(name));
drop policy if exists referee_screenshot_read on storage.objects;
create policy referee_screenshot_read on storage.objects for select to authenticated using(bucket_id='referee-feedback-screenshots' and (
 public.owns_referee_feedback_path(name) or exists(select 1 from public.event_members where user_id=auth.uid() and role='admin' and developer=true)));

alter table public.referee_external_events add column if not exists program text not null default '';
alter table public.referee_external_events add column if not exists event_type text not null default '';
create or replace function public.list_referee_event_metadata()
returns table(event_id uuid,program text,event_type text) language sql stable security definer set search_path=public as $$
 select e.id,left(coalesce(s.value->>'program',p.value->>'program',''),100),
 case when e.name ilike '%signature%' then 'signature' else coalesce(s.value->>'eventType',e.event_format,'tournament') end
 from public.events e left join public.event_settings s on s.event_id=e.id and s.key='vex_event'
 left join public.event_settings p on p.event_id=e.id and p.key='competition_program';
$$;
revoke all on function public.list_referee_event_metadata() from public,anon;
grant execute on function public.list_referee_event_metadata() to authenticated;
