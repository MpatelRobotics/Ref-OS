-- One set of robot reference toggles per event, team and league session.
create unique index if not exists robot_reference_one_team_session
on public.event_operations(event_id,coalesce(session_id,'00000000-0000-0000-0000-000000000000'::uuid),(payload->>'team'))
where kind='robot-change' and payload->>'recordType'='robot-reference';
