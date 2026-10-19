-- Attendance can be recorded by the inspection crew as well as Referees and Admins.
-- Uses existing per-event role checks and the existing session attendance table.
drop policy if exists "refs write league attendance" on public.league_session_attendance;
create policy "refs write league attendance" on public.league_session_attendance for all
 using(public.has_event_role(event_id,array['ref','inspection','admin']))
 with check(public.has_event_role(event_id,array['ref','inspection','admin']));
