begin;
alter table public.judging_portal_codes add column if not exists display_cipher bytea;

do $$
begin
 if not exists(select 1 from vault.secrets where name='judging_portal_code_display_key') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'judging_portal_code_display_key');
 end if;
end;$$;

create or replace function public.judging_code_display_key()
returns text language sql stable security definer set search_path='' as $$
 select decrypted_secret from vault.decrypted_secrets where name='judging_portal_code_display_key'
$$;
revoke all on function public.judging_code_display_key() from public,anon,authenticated;

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
  insert into public.judging_portal_codes(event_id,label,code_hash,mode,group_name,display_cipher)
  values(p_event,trim(p_label),encode(digest(v_code,'sha256'),'hex'),p_mode,case when p_mode='manual' then p_group else null end,pgp_sym_encrypt(v_code, public.judging_code_display_key()))
  on conflict (event_id,code_hash) do nothing returning id into v_id;
  if found then return jsonb_build_object('id',v_id,'code',v_code); end if;
 end loop;
 raise exception 'Could not issue a unique judge code. Try again.';
end;$$;

create or replace function public.list_judging_portal_codes(p_event uuid)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_key text;
begin
 perform public.require_judging_preview(p_event);
 v_key := public.judging_code_display_key();
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',id,'label',label,'mode',mode,'group',group_name,'enabled',enabled,
  'code',case when enabled then pgp_sym_decrypt(display_cipher,v_key) end
 ) order by created_at) from public.judging_portal_codes where event_id=p_event),'[]'::jsonb);
end;$$;

create or replace function public.replace_judging_portal_code(p_event uuid,p_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 old_code public.judging_portal_codes%rowtype;
 replacement jsonb;
begin
 perform public.require_judging_preview(p_event);
 perform 1 from public.events where id=p_event for update;
 select * into old_code from public.judging_portal_codes
 where event_id=p_event and id=p_id and enabled for update;
 if not found then raise exception 'This judge code is no longer active'; end if;
 replacement := public.create_judging_portal_code(
  p_event,old_code.label,case when old_code.group_name is null then old_code.mode else 'manual' end,old_code.group_name
 );
 perform public.disable_judging_portal_code(p_event,p_id);
 return replacement;
end;$$;
revoke all on function public.replace_judging_portal_code(uuid,uuid) from public,anon;
grant execute on function public.replace_judging_portal_code(uuid,uuid) to authenticated;
commit;
