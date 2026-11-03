begin;
create or replace function public.apply_refos_bracket_correction(p_event uuid,p_session uuid,p_division integer,p_expected jsonb,p_changes jsonb)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare current_state jsonb; c jsonb; affected integer;
begin
 if not public.has_event_role(p_event,array['admin','ref','emcee']) then raise exception 'Event access required'; end if;
 if jsonb_typeof(p_expected) <> 'array' or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes)>100 then raise exception 'Invalid bracket correction'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text||coalesce(p_session::text,'')||p_division::text,0));
 perform 1 from public.matches where event_id=p_event and session_id is not distinct from p_session and division_id=p_division for update;
 select coalesce(jsonb_agg(jsonb_build_object('phase',phase,'num',num,'red',red,'blue',blue,'winner',nullif(winner,''),'redScore',red_score,'blueScore',blue_score,'field',nullif(field,''),'label',nullif(label,'')) order by phase collate "C",num),'[]'::jsonb) into current_state
 from public.matches where event_id=p_event and session_id is not distinct from p_session and division_id=p_division and phase in ('r16','qf','sf','final');
 if current_state is distinct from p_expected then raise exception 'The bracket changed. Refresh it before trying again.'; end if;
 for c in select value from jsonb_array_elements(p_changes) loop
  if c->>'phase' not in ('r16','qf','sf','final') or coalesce((c->>'num')::integer,0)<1 or c->>'action' not in ('delete','upsert') then raise exception 'Invalid bracket match'; end if;
  if c->>'action'='delete' then
   delete from public.matches where event_id=p_event and session_id is not distinct from p_session and division_id=p_division and phase=c->>'phase' and num=(c->>'num')::integer;
   get diagnostics affected=row_count;
   if affected<>1 then raise exception 'Could not clear the dependent match'; end if;
  else
   update public.matches set red=array(select jsonb_array_elements_text(c->'red')),blue=array(select jsonb_array_elements_text(c->'blue')),winner=c->>'winner',red_score=(c->>'redScore')::integer,blue_score=(c->>'blueScore')::integer,field=c->>'field',label=c->>'label'
   where event_id=p_event and session_id is not distinct from p_session and division_id=p_division and phase=c->>'phase' and num=(c->>'num')::integer;
   get diagnostics affected=row_count;
   if affected=0 then
    insert into public.matches(event_id,session_id,division_id,phase,num,red,blue,winner,red_score,blue_score,field,label)
    values(p_event,p_session,p_division,c->>'phase',(c->>'num')::integer,array(select jsonb_array_elements_text(c->'red')),array(select jsonb_array_elements_text(c->'blue')),c->>'winner',(c->>'redScore')::integer,(c->>'blueScore')::integer,c->>'field',c->>'label');
   end if;
  end if;
 end loop;
end $$;
revoke all on function public.apply_refos_bracket_correction(uuid,uuid,integer,jsonb,jsonb) from public,anon;
grant execute on function public.apply_refos_bracket_correction(uuid,uuid,integer,jsonb,jsonb) to authenticated;
commit;
