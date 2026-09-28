-- Ref OS robot photo storage: shared cloud copy + local device cache
--
-- Robot photos stay in the private robot-photos bucket, organized by event:
--   <event-id>/team/<TEAM>/<angle>-<upload-id>.webp   (older photos: .jpg)
-- Existing read/upload policies already restrict every object to members of that event.
--
-- This file adds one permission: Inspection users can already upload robot photos, but only
-- Referee and Admin could delete bucket objects, so when Inspection replaced a photo the old
-- file stayed in the bucket. Inspection may now delete ROBOT photos (the team/ folder) of an
-- event it belongs to. It cannot delete violation evidence or another event's objects.
--
-- Safe to rerun.

drop policy if exists "inspection delete robot photos" on storage.objects;
create policy "inspection delete robot photos" on storage.objects for delete
using (
  bucket_id = 'robot-photos'
  and (storage.foldername(name))[2] = 'team'
  and public.has_event_role((storage.foldername(name))[1]::uuid, array['inspection'])
);
