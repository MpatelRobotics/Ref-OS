-- Run on the deployed schema. All fixture changes are rolled back.
begin;
do $$
declare creator uuid; visitor uuid; ev public.events%rowtype; ev2 public.events%rowtype; rejected boolean;
begin
 select id into creator from auth.users order by created_at limit 1;
 select id into visitor from auth.users where id<>creator order by created_at limit 1;
 if visitor is null then raise exception 'Two existing test identities required'; end if;
 if has_function_privilege('authenticated','public.create_deferred_admin_event(text,uuid,text)','execute')
 or has_function_privilege('authenticated','public.complete_initial_admin_setup(uuid,uuid,text)','execute') then
 raise exception 'Service-only functions exposed'; end if;
 select * into ev from public.create_deferred_admin_event('Deferred setup transactional verification',creator,'tournament');
 if not public.event_requires_admin_setup(ev.id) then raise exception 'Missing pending state'; end if;
 if exists(select 1 from public.event_access_credentials where event_id=ev.id) then raise exception 'Premature credential'; end if;
 perform set_config('request.jwt.claim.sub',creator::text,true);
 if not public.has_event_role(ev.id,array['admin']) then raise exception 'Developer creator cannot configure event'; end if;
 perform set_config('request.jwt.claim.sub',visitor::text,true);
 if public.has_event_role(ev.id,array['admin','ref']) then raise exception 'Visitor can access pending event'; end if;
 rejected:=false;
 begin
 insert into public.event_members(event_id,user_id,role) values(ev.id,visitor,'admin');
 exception when insufficient_privilege then rejected:=true;
 end;
 if not rejected then raise exception 'Ordinary membership was not blocked'; end if;
 perform public.complete_initial_admin_setup(ev.id,visitor,'3S23');
 if public.event_requires_admin_setup(ev.id) or not public.has_event_role(ev.id,array['admin']) then raise exception 'Setup did not unlock admin'; end if;
 rejected:=false;
 begin
 perform public.complete_initial_admin_setup(ev.id,creator,'4T24');
 exception when raise_exception then rejected:=true;
 end;
 if not rejected then raise exception 'Repeated setup can overwrite code'; end if;
 if not exists(select 1 from public.event_access_credentials where event_id=ev.id and credential_hash=encode(extensions.digest('3S23','sha256'::text),'hex')) then raise exception 'Original code overwritten'; end if;
 select * into ev2 from public.create_deferred_admin_event('Deferred league transactional verification',creator,'league');
 if ev2.event_format<>'league' or not public.event_requires_admin_setup(ev2.id) then raise exception 'League setup failed'; end if;
end;
$$;
rollback;
