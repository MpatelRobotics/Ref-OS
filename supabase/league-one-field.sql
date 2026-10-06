-- Run once in Supabase SQL Editor after League and event lifecycle migrations.
-- Sets all currently active leagues to one field. Admins can add fields again in Event Setup.
-- Matches, imported assignments, field names and history are not modified.
begin;
insert into public.event_settings(event_id,key,value,updated_at)
select id,'field_configuration','{"count":1}'::jsonb,now()
from public.events where event_format='league' and archived_at is null
on conflict(event_id,key) do update set value=excluded.value,updated_at=excluded.updated_at;
commit;
