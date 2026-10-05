-- Feedback screenshots. Run after the base schema, League and Developer migrations.
begin;
create table if not exists public.feedback_submission_owners (
 feedback_id uuid primary key references public.field_log(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade
);
alter table public.feedback_submission_owners enable row level security;
revoke all on public.feedback_submission_owners from anon,authenticated;
create table if not exists public.feedback_attachments (
 feedback_id uuid references public.field_log(id) on delete cascade,
 slot integer not null check(slot between 0 and 2),
 path text not null unique,
 created_by uuid not null references auth.users(id),
 primary key(feedback_id,slot)
);
alter table public.feedback_attachments enable row level security;
revoke all on public.feedback_attachments from anon,authenticated;
grant select on public.feedback_attachments to authenticated;
create or replace function public.feedback_screenshot_access(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.event_members where user_id=auth.uid() and role='admin' and developer=true)
 or exists(select 1 from public.feedback_attachments where path=p_path and created_by=auth.uid());
$$;
revoke all on function public.feedback_screenshot_access(text) from public,anon;
grant execute on function public.feedback_screenshot_access(text) to authenticated;
drop policy if exists "feedback attachment reads" on public.feedback_attachments;
create policy "feedback attachment reads" on public.feedback_attachments for select to authenticated using(public.feedback_screenshot_access(path));

create or replace function public.submit_feedback_with_screenshots(p_event uuid,p_id uuid,p_note text,p_by text,p_session uuid default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.has_event_role(p_event,array['admin','ref','judge','emcee','inspection']) then raise exception 'Event access required' using errcode='42501'; end if;
 if not exists(select 1 from public.events where id=p_event and archived_at is null) then raise exception 'Event unavailable'; end if;
 if length(trim(coalesce(p_note,''))) not between 1 and 2000 then raise exception 'Feedback message required (maximum 2000 characters)'; end if;
 if p_session is not null and not exists(select 1 from public.league_sessions where id=p_session and event_id=p_event) then raise exception 'Invalid session'; end if;
 if exists(select 1 from public.field_log where id=p_id) then
   if not exists(select 1 from public.feedback_submission_owners o join public.field_log f on f.id=o.feedback_id where o.feedback_id=p_id and o.user_id=auth.uid() and f.event_id=p_event and f.kind='feedback' and f.session_id is not distinct from p_session) then raise exception 'Feedback ownership required' using errcode='42501'; end if;
   -- Retries do not rewrite the already saved message or create another submission.
   return;
 end if;
 insert into public.field_log(id,event_id,kind,note,logged_by,session_id) values(p_id,p_event,'feedback',trim(p_note),left(p_by,150),p_session);
 insert into public.feedback_submission_owners(feedback_id,user_id) values(p_id,auth.uid());
end;
$$;
create or replace function public.register_feedback_screenshot(p_feedback uuid,p_slot integer,p_path text)
returns void language plpgsql security definer set search_path=public as $$
declare expected_prefix text;
begin
 if not exists(select 1 from public.feedback_submission_owners where feedback_id=p_feedback and user_id=auth.uid()) then raise exception 'Feedback ownership required' using errcode='42501'; end if;
 if p_slot is null or p_slot not between 0 and 2 then raise exception 'Maximum three screenshots'; end if;
 select f.event_id::text || '/' || auth.uid()::text || '/' || p_feedback::text || '/' || p_slot::text into expected_prefix from public.field_log f where id=p_feedback and kind='feedback';
 if p_path is null or p_path not in (expected_prefix || '.webp',expected_prefix || '.jpg') then raise exception 'Invalid screenshot path'; end if;
 if not exists(select 1 from storage.objects where bucket_id='feedback-screenshots' and name=p_path) then raise exception 'Screenshot upload missing'; end if;
 insert into public.feedback_attachments(feedback_id,slot,path,created_by) values(p_feedback,p_slot,p_path,auth.uid())
 on conflict(feedback_id,slot) do update set path=excluded.path;
end;
$$;
revoke all on function public.submit_feedback_with_screenshots(uuid,uuid,text,text,uuid) from public,anon;
revoke all on function public.register_feedback_screenshot(uuid,integer,text) from public,anon;
grant execute on function public.submit_feedback_with_screenshots(uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.register_feedback_screenshot(uuid,integer,text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('feedback-screenshots','feedback-screenshots',false,1572864,array['image/webp','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.feedback_screenshot_upload_allowed(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.feedback_submission_owners o join public.field_log f on f.id=o.feedback_id
 where o.user_id=auth.uid() and f.kind='feedback' and public.has_event_role(f.event_id,array['admin','ref','judge','emcee','inspection'])
 and p_path in (
 f.event_id::text || '/' || auth.uid()::text || '/' || f.id::text || '/0.webp',
 f.event_id::text || '/' || auth.uid()::text || '/' || f.id::text || '/1.webp',
 f.event_id::text || '/' || auth.uid()::text || '/' || f.id::text || '/2.webp',
 f.event_id::text || '/' || auth.uid()::text || '/' || f.id::text || '/0.jpg',
 f.event_id::text || '/' || auth.uid()::text || '/' || f.id::text || '/1.jpg',
 f.event_id::text || '/' || auth.uid()::text || '/' || f.id::text || '/2.jpg'));
$$;
revoke all on function public.feedback_screenshot_upload_allowed(text) from public,anon;
grant execute on function public.feedback_screenshot_upload_allowed(text) to authenticated;
drop policy if exists "feedback screenshot upload" on storage.objects;
create policy "feedback screenshot upload" on storage.objects for insert to authenticated with check(
 bucket_id='feedback-screenshots' and (storage.foldername(name))[2]=auth.uid()::text
 and public.feedback_screenshot_upload_allowed(name)
);
drop policy if exists "feedback screenshot read" on storage.objects;
create policy "feedback screenshot read" on storage.objects for select to authenticated using(bucket_id='feedback-screenshots' and public.feedback_screenshot_access(name));
-- Uploads use unique paths. Registered objects are immutable; retry reads skip them.
commit;
