begin;
create or replace function public.delete_judge_groups(p_event uuid,p_groups text[])
returns void language plpgsql security definer set search_path=public as $$
declare s record;removed text[];next_value jsonb;
begin
 if not public.has_event_role(p_event,array['admin','judge']) then raise exception 'Judge Advisor access required';end if;
 if p_groups is null or cardinality(p_groups)=0 then raise exception 'Choose groups to delete';end if;
 for s in select * from public.judging_interview_schedules where event_id=p_event order by session_id for update loop
  select coalesce(array_agg(distinct team),'{}'::text[]) into removed from (
   select e->>'team' team from jsonb_array_elements(coalesce(s.value->'entries','[]')) e where e->>'group'=any(p_groups)
   union select jsonb_array_elements_text(g->'teams') from jsonb_array_elements(coalesce(s.value->'groups','[]')) g where g->>'name'=any(p_groups)
  ) x;
  next_value=s.value||jsonb_build_object(
   'entries',coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(s.value->'entries','[]')) e where not coalesce(e->>'group'=any(p_groups),false)),'[]'::jsonb),
   'groups',coalesce((select jsonb_agg(g) from jsonb_array_elements(coalesce(s.value->'groups','[]')) g where not coalesce(g->>'name'=any(p_groups),false)),'[]'::jsonb),
   'completions',coalesce(s.value->'completions','{}'::jsonb)-removed);
  if next_value is distinct from s.value then update public.judging_interview_schedules set value=next_value,version=version+1 where event_id=p_event and session_id is not distinct from s.session_id;end if;
 end loop;
 delete from public.judge_group_sessions where event_id=p_event and group_name=any(p_groups);
 delete from public.judge_group_credentials where event_id=p_event and group_name=any(p_groups);
end;$$;
revoke all on function public.delete_judge_groups(uuid,text[]) from public,anon;
grant execute on function public.delete_judge_groups(uuid,text[]) to authenticated;
commit;
