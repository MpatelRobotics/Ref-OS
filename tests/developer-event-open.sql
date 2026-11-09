begin;
do $$
declare u uuid;visitor uuid;source public.events%rowtype;target public.events%rowtype;rejected boolean=false;
begin
 select id into u from auth.users order by created_at limit 1;
 select id into visitor from auth.users where id<>u and not public.refos_is_developer(id) limit 1;
 select * into source from public.create_deferred_admin_event('Developer open verification source',u,'tournament');
 perform set_config('request.jwt.claim.sub',u::text,true);
 select * into target from public.create_refos_vex_event('Developer open verification target','3S23');
 perform public.open_developer_event(target.id);
 if not exists(select 1 from public.event_members where event_id=target.id and user_id=u and developer and role='admin') then raise exception 'Developer flag was stripped';end if;
 perform public.require_judging_preview(target.id);
 perform set_config('request.jwt.claim.sub',visitor::text,true);
 begin perform public.open_developer_event(target.id);exception when insufficient_privilege then rejected=true;end;
 if not rejected then raise exception 'Non-developer opened event';end if;
end;$$;
rollback;
