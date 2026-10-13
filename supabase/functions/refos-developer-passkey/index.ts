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
 let service: SupabaseClient | undefined, eventId='', userId='';
 try {
  if(!origin.startsWith('https://') || new URL(origin).origin!==origin || new URL(origin).hostname!==rpID || request.headers.get('Origin')!==origin)throw Error();
  const secret = (Deno.env.get('REFOS_SUPER_ADMIN_CODE') || '').trim().toUpperCase();
  if(!/^[0-9][A-Z][0-9][0-9]$/.test(secret))throw Error();
  const versionKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const secretVersion=isoBase64URL.fromBuffer(new Uint8Array(await crypto.subtle.sign('HMAC',versionKey,new TextEncoder().encode(`refos-passkey:${secret}`))));
  const authorization=request.headers.get('Authorization');if(!authorization)throw Error();
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}}});
  service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:user,error:userError}=await client.auth.getUser();if(userError||!user.user)throw Error();userId=user.user.id;
  const body=await request.json();if(JSON.stringify(body).length>20000)throw Error();
  const action=body.action;
  if(action==='register-options'||action==='authenticate-options'){
   eventId=String(body.eventId||'');
  }else{
   const {data,error}=await service.rpc('consume_developer_passkey_challenge',{p_id:body.challengeId,p_user:userId});
   if(error||data?.length!==1)throw Error();
   const challenge=data[0];eventId=challenge.event_id;
   if(challenge.secret_version!==secretVersion || (action==='register-verify'?'register':action==='authenticate-verify'?'authenticate':'')!==challenge.kind)throw Error();
   body.challenge=challenge.challenge;
  }
  const {data:event,error:eventError}=await service.from('events').select('id,archived_at').eq('id',eventId).maybeSingle();
  if(eventError||!event||event.archived_at)throw Error();
  const {data:locked,error:lockError}=await service.rpc('refos_access_locked',{p_event:eventId,p_user:userId});if(lockError||locked)throw Error();
  if(action==='register-options'){
   // Fresh Developer code is mandatory; ordinary Admin membership cannot register a passkey.
   const submitted=String(body.credential||'').trim().toUpperCase();
   const a=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(submitted)));
   const b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)));
   let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];if(diff)throw Error();
  }
  if(action.endsWith('-options')){
   const options=action==='register-options' ? await generateRegistrationOptions({rpName:'Ref OS Developer',rpID,userName:'Ref OS Developer',userID:crypto.getRandomValues(new Uint8Array(32)),attestationType:'none',supportedAlgorithmIDs:[-7,-257],authenticatorSelection:{residentKey:'required',userVerification:'required',authenticatorAttachment:'platform'}}) : await generateAuthenticationOptions({rpID,userVerification:'required'});
   // Bound to this device session, five minutes, one use. Never disclose credential lists.
   await service.from('developer_passkey_challenges').delete().eq('user_id',userId);
   const {data,error}=await service.from('developer_passkey_challenges').insert({user_id:userId,event_id:eventId,kind:action==='register-options'?'register':'authenticate',challenge:options.challenge,secret_version:secretVersion}).select('id').single();
   if(error)throw Error();return reply({options,challengeId:data.id});
  }
  if(action==='register-verify'){
   const result=await verifyRegistrationResponse({response:body.response,expectedChallenge:body.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true});
   if(!result.verified||!result.registrationInfo)throw Error();
   const credential=result.registrationInfo.credential;
   const {error}=await service.from('developer_passkeys').insert({id:credential.id,public_key:isoBase64URL.fromBuffer(credential.publicKey),counter:credential.counter,transports:credential.transports||[],secret_version:secretVersion,rp_id:rpID});if(error)throw Error();
  }else if(action==='authenticate-verify'){
   const {data:credential,error}=await service.from('developer_passkeys').select('*').eq('id',body.response?.id).eq('secret_version',secretVersion).eq('rp_id',rpID).maybeSingle();if(error||!credential)throw Error();
   const result=await verifyAuthenticationResponse({response:body.response,expectedChallenge:body.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true,credential:{id:credential.id,publicKey:isoBase64URL.toBuffer(credential.public_key),counter:Number(credential.counter),transports:credential.transports}});
   if(!result.verified)throw Error();
   const {data:updated,error:updateError}=await service.from('developer_passkeys').update({counter:result.authenticationInfo.newCounter}).eq('id',credential.id).eq('counter',credential.counter).select('id');if(updateError||updated?.length!==1)throw Error();
  }else throw Error();
  const {error:claimError}=await service.rpc('claim_developer_event_access',{p_event:eventId,p_user:userId});if(claimError)throw Error();
  await service.rpc('refos_access_attempt',{p_event:eventId,p_user:userId,p_ok:true});
  return reply({ok:true});
 }catch{
  if(service&&eventId&&userId){try{await service.rpc('refos_access_attempt',{p_event:eventId,p_user:userId,p_ok:false});}catch{}}
  return reply({error:'Passkey sign-in could not be verified. Use your Developer code or try again.'},400);
 }
});
