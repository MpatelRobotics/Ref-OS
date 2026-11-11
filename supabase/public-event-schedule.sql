-- Public audience data, limited to visible events and an explicit projection of competition results.
create or replace function public.get_public_event_schedule(p_event uuid, p_preview boolean default false)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
 event_program text;
 event_zone text;
begin
 if not exists (
  select 1 from public.list_refos_events() visible
  join public.events e on e.id=visible.event_id
  where e.id=p_event and e.archived_at is null
 ) or public.event_requires_admin_setup(p_event) or not exists (
  select 1 from public.matches where event_id=p_event
 ) then return jsonb_build_object('available',false); end if;
 if p_preview then return jsonb_build_object('available',true); end if;

 select program into event_program from public.list_refos_event_programs() where event_id=p_event;
 select value->>'zone' into event_zone from public.event_settings
 where event_id=p_event and key='event_timezone';

 return (
  with scopes as (
   select distinct coalesce(m.division_id,0) as division_id,m.session_id
   from public.matches m where m.event_id=p_event
  ), settings_keys as (
   select s.*, case when s.division_id=0 then '' else 'division:'||s.division_id||':' end as prefix,
    case when s.session_id is null then '' else '@'||s.session_id end as suffix
   from scopes s
  )
  select jsonb_build_object(
   'available',true,'program',event_program,'timezone',coalesce(event_zone,'UTC'),
   'teams',coalesce((select jsonb_object_agg(t.number,t.name) from public.teams t where t.event_id=p_event),'{}'::jsonb),
   'schedules',(select jsonb_agg(jsonb_build_object(
    'division',s.division_id,'session',s.session_id,'sessionName',ls.name,
    'matches',(select jsonb_agg(jsonb_build_object(
     'phase',m.phase,'num',m.num,'label',m.label,'field',m.field,'scheduled',m.scheduled,
     'red',m.red,'blue',m.blue,'redScore',m.red_score,'blueScore',m.blue_score
    ) order by case m.phase when 'practice' then 0 when 'qual' then 1 when 'r16' then 2 when 'qf' then 3 when 'sf' then 4 when 'final' then 5 else 6 end,m.num)
    from public.matches m where m.event_id=p_event and coalesce(m.division_id,0)=s.division_id and m.session_id is not distinct from s.session_id),
    'times',coalesce((select jsonb_agg(jsonb_build_object(
     'phase',r->>'phase','num',r->>'num','scheduledAt',r->>'scheduledAt','red',r->'red','blue',r->'blue'
    )) from jsonb_array_elements(case when jsonb_typeof(times.value->'rows')='array' then times.value->'rows' else '[]'::jsonb end) r),'[]'::jsonb),
    'ranks',case when s.division_id=0 and s.session_id is null then
      coalesce((select jsonb_object_agg(t.number,t.rank) from public.teams t where t.event_id=p_event and t.rank is not null),'{}'::jsonb)
     else coalesce((select jsonb_object_agg(r.key,r.value)
      from jsonb_each(case when jsonb_typeof(ranking.value->'ranks')='object' then ranking.value->'ranks' else '{}'::jsonb end) r
      where jsonb_typeof(r.value)='number'),'{}'::jsonb) end
   ) order by ls.ord nulls first,s.division_id)
   from settings_keys s
   left join public.league_sessions ls on ls.event_id=p_event and ls.id=s.session_id
   left join public.event_settings times on times.event_id=p_event and times.key=s.prefix||'tm_match_times'||s.suffix
   left join public.event_settings ranking on ranking.event_id=p_event and ranking.key=s.prefix||'rank_snapshot'||s.suffix)
  )
 );
end;$$;
revoke all on function public.get_public_event_schedule(uuid,boolean) from public;
grant execute on function public.get_public_event_schedule(uuid,boolean) to anon,authenticated;
