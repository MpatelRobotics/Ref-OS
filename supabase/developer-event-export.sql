-- Full event content export is available only to a verified developer for this event.
begin;
create or replace function public.refos_export_content(value jsonb)
returns jsonb language plpgsql immutable set search_path=public as $$
declare result jsonb; item record;
begin
 if jsonb_typeof(value)='object' then
  result='{}';
  for item in select * from jsonb_each(value) loop
   if item.key !~* '(password|secret|token|credential|authorization|code_hash|api_key|pairing|access_code|role_code|join_code)' then
    result=result||jsonb_build_object(item.key,public.refos_export_content(item.value));
   end if;
  end loop;
  return result;
 elsif jsonb_typeof(value)='array' then
  return coalesce((select jsonb_agg(public.refos_export_content(v)) from jsonb_array_elements(value) v),'[]');
 end if;
 return value;
end;$$;
revoke all on function public.refos_export_content(jsonb) from public,anon,authenticated;

create or replace function public.export_refos_developer_event(p_event uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare tab record; rows jsonb; tables jsonb='{}'; event jsonb; photos jsonb;
begin
 if not exists(select 1 from public.event_members where event_id=p_event and user_id=auth.uid() and role='admin' and developer=true)
 then raise exception 'Developer login required for this event' using errcode='42501'; end if;
 select to_jsonb(e) into event from public.events e where e.id=p_event;
 if event is null then raise exception 'Event not found'; end if;
 for tab in
  select c.table_name from information_schema.columns c join information_schema.tables t using(table_schema,table_name)
  where c.table_schema='public' and c.column_name='event_id' and t.table_type='BASE TABLE'
  and (c.table_name='league_sessions' or c.table_name !~* '(credential|access_attempt|session$|sessions$|ticket|login|push_subscription|push_dispatch|portal_codes|submission_owners)')
  order by c.table_name
 loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r where event_id=$1',tab.table_name) into rows using p_event;
  if tab.table_name='event_settings' then
   select coalesce(jsonb_agg(v),'[]') into rows from jsonb_array_elements(rows) v
   where coalesce(v->>'key','') !~* '(role.?access|role.?code|credential|token|password|secret|pairing|api.?key)';
  end if;
  tables=tables||jsonb_build_object(tab.table_name,public.refos_export_content(rows));
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',name)),'[]') into photos
 from storage.objects where split_part(name,'/',1)=p_event::text;
 return jsonb_build_object('format','refos-developer-event-export','version',1,'exportedAt',now(),'event',public.refos_export_content(event),'tables',tables,'photos',photos);
end;$$;
revoke all on function public.export_refos_developer_event(uuid) from public,anon;
grant execute on function public.export_refos_developer_event(uuid) to authenticated;
commit;
