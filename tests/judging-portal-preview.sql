-- Transactional integration verification; fixture data never persists.
begin;
do $$
declare u uuid;v uuid; e public.events%rowtype; a jsonb;b jsonb;r jsonb;g text;g2 text;rejected boolean;
begin
 select id into u from auth.users order by created_at limit 1;
 select id into v from auth.users where id<>u order by created_at limit 1;
 select * into e from public.create_deferred_admin_event('Judging portal transactional test',u,'tournament');
 perform public.complete_initial_admin_setup(e.id,v,'3S23');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.create_judge_group_code(e.id,'North');perform public.create_judge_group_code(e.id,'South');
 perform public.save_judge_group_conflicts(e.id,'North','{}'::text[],'No affiliations',0);
 perform public.save_judge_group_conflicts(e.id,'South','{}'::text[],'No affiliations',0);
 insert into public.teams(event_id,number,name) values(e.id,'119A','Test One'),(e.id,'255B','Test Two');
 perform public.save_judging_interview_schedule(e.id,null,'{"duration":10,"entries":[],"groups":[{"name":"North","teams":["119A"]},{"name":"South","teams":["255B"]}]}',0);
 a=public.create_judging_portal_code(e.id,'Manual Judge','manual','North');
 if (a->>'code') !~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$' then raise exception 'Expected five-character judge code'; end if;
 r=public.login_judging_portal_code(e.id,a->>'code');
 if r->>'group'<>'North' then raise exception 'Manual assignment failed';end if;
 perform public.save_judging_interview_notes(e.id,null,'119A','Private interview observation',0);
 rejected=false;
 begin perform public.save_judging_interview_notes(e.id,null,'255B','Wrong group',0);exception when raise_exception then rejected=true;end;
 if not rejected then raise exception 'Cross-group write allowed';end if;
 rejected=false;
 begin perform public.save_judging_interview_notes(e.id,null,'119A','Stale overwrite',0);exception when serialization_failure then rejected=true;end;
 if not rejected then raise exception 'Stale notes overwrite allowed';end if;
 b=public.create_judging_portal_code(e.id,'Random Judge','random',null);
 g=public.login_judging_portal_code(e.id,b->>'code')->>'group';
 if g<>'South' then raise exception 'Random assignment did not balance groups';end if;
 g2=public.login_judging_portal_code(e.id,b->>'code')->>'group';
 if g2<>g then raise exception 'Random assignment changed on repeat login';end if;
 if jsonb_array_length(public.list_judging_interview_notes(e.id,false))<>0 then raise exception 'Other group notes leaked';end if;
 if jsonb_array_length(public.list_judging_interview_notes(e.id,true))<>1 then raise exception 'Advisor notes missing';end if;
 perform public.disable_judging_portal_code(e.id,(b->>'id')::uuid);
 rejected=false;
 begin perform public.judge_group_dashboard(e.id);exception when raise_exception then rejected=true;end;
 if not rejected then raise exception 'Disabled code session retained access';end if;
 perform set_config('request.jwt.claim.sub',v::text,true);
 if jsonb_array_length(public.list_judging_interview_notes(e.id,true))<>1 then raise exception 'Event admin cannot review judging notes';end if;
 delete from public.event_members where event_id=e.id and user_id=v;
 rejected=false;
 begin perform public.list_judging_interview_notes(e.id,true);exception when insufficient_privilege then rejected=true;end;
 if not rejected then raise exception 'Unauthorized user accessed advisor notes';end if;
 r=public.login_judging_portal_code(e.id,a->>'code');
 if not (r->>'ok')::boolean then raise exception 'Valid judge code login failed';end if;
 perform public.judging_portal_dashboard(e.id);
 if public.has_event_role(e.id,array['admin','judge','ref']) then raise exception 'Judge login gained general event membership';end if;
 if jsonb_array_length(public.list_judging_interview_notes(e.id,false))<>1 then raise exception 'Assigned judge cannot read notes';end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('refos.lifecycle_change','on',true);
 update public.events set archived_at=now() where id=e.id;
 delete from public.events where id=e.id;
 if exists(select 1 from public.judging_interview_notes where event_id=e.id)
 or exists(select 1 from public.judging_portal_codes where event_id=e.id)
 or exists(select 1 from public.judging_portal_logins where event_id=e.id) then raise exception 'Event deletion left judging data behind';end if;
end;$$;
rollback;
