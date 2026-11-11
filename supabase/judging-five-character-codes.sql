begin;
create or replace function public.create_judging_portal_code(p_event uuid,p_label text,p_mode text,p_group text default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
 v_code text;
 v_id uuid;
 v_bytes bytea;
 v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
begin
 perform public.require_judging_preview(p_event);
 if p_label is null or length(trim(p_label)) not between 1 and 100 or p_mode is null or p_mode not in ('manual','random') then raise exception 'Enter a judge name and assignment mode';end if;
 if p_mode='manual' and not exists(select 1 from public.judge_group_credentials where event_id=p_event and group_name=p_group and enabled) then raise exception 'Choose an enabled judge group';end if;
 if not exists(select 1 from public.judge_group_credentials where event_id=p_event and enabled) then raise exception 'Create an enabled judge group first';end if;
 -- Draw five independent base-32 characters from cryptographic random bytes.
 for v_attempt in 1..20 loop
  v_bytes := gen_random_bytes(5);
  v_code := '';
  for v_index in 0..4 loop
   v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes,v_index) & 31), 1);
  end loop;
  insert into public.judging_portal_codes(event_id,label,code_hash,mode,group_name)
  values(p_event,trim(p_label),encode(digest(v_code,'sha256'),'hex'),p_mode,case when p_mode='manual' then p_group else null end)
  on conflict (event_id,code_hash) do nothing returning id into v_id;
  if found then return jsonb_build_object('id',v_id,'code',v_code); end if;
 end loop;
 raise exception 'Could not issue a unique judge code. Try again.';
end;$$;
commit;
