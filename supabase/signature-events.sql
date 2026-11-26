-- Signature status is event-wide and only developers may change it, including through direct API requests.
create or replace function public.guard_refos_signature_event()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if (TG_OP <> 'INSERT' and old.key='signature_event') or (TG_OP <> 'DELETE' and new.key='signature_event') then
  if not coalesce(public.refos_is_developer(auth.uid()),false) then
   raise exception 'Developer access required to change Signature Event status.' using errcode='42501';
  end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end;
$$;
drop trigger if exists guard_refos_signature_event on public.event_settings;
create trigger guard_refos_signature_event before insert or update or delete on public.event_settings
for each row execute function public.guard_refos_signature_event();

create or replace function public.list_refos_signature_events()
returns table(event_id uuid, enabled boolean)
language sql stable security definer set search_path=public as $$
 select visible.event_id, coalesce(s.value->'enabled'='true'::jsonb,false)
 from public.list_refos_events() visible
 left join public.event_settings s on s.event_id=visible.event_id and s.key='signature_event';
$$;
revoke all on function public.list_refos_signature_events() from public;
grant execute on function public.list_refos_signature_events() to anon,authenticated;
