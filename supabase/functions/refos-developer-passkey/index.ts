import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@14.0.3';
import { isoBase64URL } from 'npm:@simplewebauthn/server@14.0.3/helpers';

Deno.serve(async request => {
 const origin = Deno.env.get('REFOS_PASSKEY_ORIGIN') || '';
 const rpID = Deno.env.get('REFOS_PASSKEY_RP_ID') || '';
 const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type', 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
 const reply = (data: unknown, status=200) => new Response(JSON.stringify(data), {status,headers});
 if(request.method==='OPTIONS')return reply({});
 if(request.method!=='POST')return reply({error:'Invalid request.'},405);
 let service: SupabaseClient | undefined, eventId='', userId='', stage='configuration';
 try {
  if(!origin.startsWith('https://') || new URL(origin).origin!==origin || new URL(origin).hostname!==rpID)throw Error();
  stage='origin';if(request.headers.get('Origin')!==origin)throw Error();
  stage='configuration';
  const secret = (Deno.env.get('REFOS_SUPER_ADMIN_CODE') || '').trim().toUpperCase();
  if(!/^[0-9][A-Z][0-9][0-9]$/.test(secret))throw Error();
  const versionKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const secretVersion=isoBase64URL.fromBuffer(new Uint8Array(await crypto.subtle.sign('HMAC',versionKey,new TextEncoder().encode(`refos-passkey:${secret}`))));
  stage='session';
  const authorization=request.headers.get('Authorization');if(!authorization)throw Error();
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}}});
  service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:user,error:userError}=await client.auth.getUser();if(userError||!user.user)throw Error();userId=user.user.id;
  const body=await request.json();if(JSON.stringify(body).length>20000)throw Error();
  const action=body.action;
  if(['manage-list','manage-rename','manage-revoke','manage-logout','manage-logout-all'].includes(action)){
   const {data:access,error:accessError}=await service.from('event_members').select('event_id').eq('user_id',userId).eq('role','admin').eq('developer',true).limit(1);
   if(accessError||!access?.length)return reply({error:'Developer access required.',reason:'access'},403);
   stage='management';
   if(action==='manage-rename'){
    const label=String(body.label||'').trim();if(!label||label.length>80)throw Error();
    const {data,error}=await service.from('developer_passkeys').update({label}).eq('id',body.id).eq('secret_version',secretVersion).eq('rp_id',rpID).select('id');if(error||data?.length!==1)throw Error();return reply({ok:true});
   }
   if(action==='manage-revoke'){
    const {data,error}=await service.from('developer_passkeys').delete().eq('id',body.id).eq('secret_version',secretVersion).eq('rp_id',rpID).select('id');if(error||data?.length!==1)throw Error();return reply({ok:true});
   }
   if(action==='manage-logout-all'){
    if(body.confirmation!=='SIGN VOLUNTEERS OUT')return reply({error:'Confirmation required.'},400);
    const {data,error}=await service.rpc('revoke_all_refos_device_access',{p_actor:userId});
    if(error)throw error;return reply({ok:true,...data});
   }
   if(action==='manage-logout'){
    if(typeof body.userId!=='string'||! /^[0-9a-f-]{36}$/i.test(body.userId))throw Error();
    const {error}=await service.rpc('revoke_refos_device_access',{p_user:body.userId});if(error)throw Error();return reply({ok:true,self:body.userId===userId});
   }
   const all = async (table:string,columns:string) => {const rows: Array<Record<string,any>>=[];for(let offset=0;offset<20000;offset+=1000){const {data,error}=await service!.from(table).select(columns).order(table==='events'?'id':'user_id').range(offset,offset+999);if(error)throw error;rows.push(...data as unknown as Array<Record<string,any>>);if(data.length<1000)return rows;}throw Error();};
   const {data:passkeys,error:keyError}=await service.from('developer_passkeys').select('id,label,created_at,last_used_at').eq('secret_version',secretVersion).eq('rp_id',rpID).order('created_at');if(keyError)throw Error();
   const [members,activity,events]=await Promise.all([all('event_members','user_id,event_id,name,role,developer'),all('user_live_activity','user_id,device_id,display_name,event_id,screen,visible,updated_at'),all('events','id,name')]);
   const devices=[...new Set(members.map(row=>row.user_id))].map(id=>({userId:id,current:id===userId,name:activity.find(row=>row.user_id===id)?.display_name||members.find(row=>row.user_id===id)?.name||'Unnamed device',events:members.filter(row=>row.user_id===id).map(row=>({name:events.find(event=>event.id===row.event_id)?.name||'Event',role:row.developer?'Developer':row.role})),activity:activity.filter(row=>row.user_id===id).sort((a,b)=>b.updated_at.localeCompare(a.updated_at))}));
   return reply({passkeys,devices});
  }
  stage='challenge';
  if(action==='register-options'||action==='authenticate-options'){
   eventId=String(body.eventId||'');
  }else{
   const {data,error}=await service.rpc('consume_developer_passkey_challenge',{p_id:body.challengeId,p_user:userId});
   if(error||data?.length!==1)throw Error();
   const challenge=data[0];eventId=challenge.event_id;
   if(challenge.secret_version!==secretVersion || (action==='register-verify'?'register':action==='authenticate-verify'?'authenticate':'')!==challenge.kind)throw Error();
   body.challenge=challenge.challenge;
  }
  stage='event';
  const {data:event,error:eventError}=await service.from('events').select('id,archived_at').eq('id',eventId).maybeSingle();
  if(eventError||!event||event.archived_at)throw Error();
  stage='lockout';
  const {data:locked,error:lockError}=await service.rpc('refos_access_locked',{p_event:eventId,p_user:userId});if(lockError){stage='storage';throw Error();}if(locked)throw Error();
  if(action==='register-options'){
   // Fresh Developer code is mandatory; ordinary Admin membership cannot register a passkey.
   stage='developer-code';
   const submitted=String(body.credential||'').trim().toUpperCase();
   const a=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(submitted)));
   const b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)));
   let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];if(diff)throw Error();
  }
  if(action.endsWith('-options')){
   stage='options';
   const options=action==='register-options' ? await generateRegistrationOptions({rpName:'Ref OS Developer',rpID,userName:'Ref OS Developer',userID:crypto.getRandomValues(new Uint8Array(32)),attestationType:'none',supportedAlgorithmIDs:[-7,-257],authenticatorSelection:{residentKey:'required',userVerification:'required',authenticatorAttachment:'platform'}}) : await generateAuthenticationOptions({rpID,userVerification:'required'});
   stage='storage';
   // Bound to this device session, five minutes, one use. Never disclose credential lists.
   await service.from('developer_passkey_challenges').delete().eq('user_id',userId);
   const {data,error}=await service.from('developer_passkey_challenges').insert({user_id:userId,event_id:eventId,kind:action==='register-options'?'register':'authenticate',challenge:options.challenge,secret_version:secretVersion}).select('id').single();
   if(error)throw Error();return reply({options,challengeId:data.id});
  }
  stage='verification';
  if(action==='register-verify'){
   const result=await verifyRegistrationResponse({response:body.response,expectedChallenge:body.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true});
   if(!result.verified||!result.registrationInfo)throw Error();
   const credential=result.registrationInfo.credential;
   const {error}=await service.from('developer_passkeys').insert({id:credential.id,public_key:isoBase64URL.fromBuffer(credential.publicKey),counter:credential.counter,transports:credential.transports||[],secret_version:secretVersion,rp_id:rpID});if(error)throw Error();
  }else if(action==='authenticate-verify'){
   const {data:credential,error}=await service.from('developer_passkeys').select('*').eq('id',body.response?.id).eq('secret_version',secretVersion).eq('rp_id',rpID).maybeSingle();if(error||!credential)throw Error();
   const result=await verifyAuthenticationResponse({response:body.response,expectedChallenge:body.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true,credential:{id:credential.id,publicKey:isoBase64URL.toBuffer(credential.public_key),counter:Number(credential.counter),transports:credential.transports}});
   if(!result.verified)throw Error();
   const {data:updated,error:updateError}=await service.from('developer_passkeys').update({counter:result.authenticationInfo.newCounter,last_used_at:new Date().toISOString()}).eq('id',credential.id).eq('counter',credential.counter).select('id');if(updateError||updated?.length!==1)throw Error();
  }else throw Error();
  const {error:claimError}=await service.rpc('claim_developer_event_access',{p_event:eventId,p_user:userId});if(claimError)throw Error();
  await service.rpc('refos_access_attempt',{p_event:eventId,p_user:userId,p_ok:true});
  return reply({ok:true});
 }catch{
  if(service&&eventId&&userId&&['developer-code','verification'].includes(stage)){try{await service.rpc('refos_access_attempt',{p_event:eventId,p_user:userId,p_ok:false});}catch{}}
  const messages: Record<string,string> = {configuration:'Passkey server configuration is incomplete.',origin:'Open https://www.ref-os.fyi to use your passkey.',session:'Your device sign-in could not be verified. Reload and try again.',event:'The sign-in event is unavailable or archived.',lockout:'Developer sign-in is temporarily locked. Wait five minutes and try again.', 'developer-code':'Developer code was not accepted. Enter your Developer code and try setup again.',options:'The server could not prepare passkey setup.',storage:'Passkey storage is unavailable. Check the developer-passkeys.sql migration.',challenge:'Passkey request expired or could not be read. Try again.',verification:'Passkey could not be verified. Try again or use your Developer code.'};
  console.error('Developer passkey failed at stage:',stage);
  return reply({error:messages[stage] || 'Passkey sign-in could not be verified.',reason:stage},400);
 }
});
