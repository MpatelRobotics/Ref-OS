import {uuid} from './uuid.js';
import {normalizeRefereeLocation} from './refereeLocations';
import {supabase} from './supabaseClient';
export async function accountUser(){const {data,error}=await supabase.auth.getUser();if(error && error.name!=='AuthSessionMissingError')throw error;return data?.user && !data.user.is_anonymous?data.user:null;}
export async function loadRefereeProfile(userId){
 const [profile,plans]=await Promise.all([supabase.from('referee_profiles').select('*').eq('user_id',userId).maybeSingle(),supabase.from('referee_event_plans').select('event_id,attendance').eq('user_id',userId)]);
 if(profile.error)throw profile.error;if(plans.error)throw plans.error;
 return {profile:profile.data,plans:plans.data||[]};
}
export async function saveRefereeProfile(userId,profile){const {error}=await supabase.from('referee_profiles').upsert({...normalizeRefereeLocation(profile),map_name:profile.map_visible?(profile.map_name||profile.full_name||'').trim().slice(0,60):(profile.map_name||''),user_id:userId});if(error){if(/photo_path/i.test(error.message||''))throw Error('Profile photos are not set up yet. Run referee-portal-expansion.sql.');if(/programs|languages/i.test(error.message||''))throw Error('Profile options are not set up yet. Ask the developer to run referee-profile-calendar.sql in Supabase.');if(/map_visible|map_name|schema cache/i.test(error.message||''))throw Error('Map sharing is not set up in the database yet. Ask the developer to run referee-community.sql in Supabase, then try again.');throw error;}}
export async function saveEventPlan(userId,eventId,attendance){
 const result=attendance?await supabase.from('referee_event_plans').upsert({user_id:userId,event_id:eventId,attendance}):await supabase.from('referee_event_plans').delete().eq('user_id',userId).eq('event_id',eventId);
 if(result.error)throw result.error;
}

export async function setRefereePasscode(code){const {error}=await supabase.rpc('set_referee_passcode',{p_code:code});if(error)throw error;}
export async function hasRefereePasscode(){const {data,error}=await supabase.rpc('has_referee_passcode');if(error)throw error;return data===true;}
export async function claimRefereePasscode(eventId,code=null){
 const {data,error}=await supabase.rpc('claim_referee_passcode',{p_event:eventId,p_code:code});if(error)throw error;
 if(data!=='ok')throw Error(data==='locked'?'Too many attempts. Try again in five minutes.':data==='archived'?'This event is archived or unavailable.':'Passcode not accepted. Select this event as attended or going in your referee account.');
}
export async function refereeEventCatalog(){const [catalog,dates,metadata]=await Promise.all([supabase.rpc('list_referee_event_catalog'),supabase.rpc('list_referee_event_dates'),supabase.rpc('list_referee_event_metadata')]);if(catalog.error)throw catalog.error;if(metadata.error)throw Error('Portal enhancements are not set up yet. Run referee-portal-expansion.sql.');if(dates.error)throw Error('Event dates are not set up yet. Ask the developer to run referee-profile-calendar.sql.');return (catalog.data||[]).map(event=>({...event,...(dates.data||[]).find(row=>row.event_id===event.event_id),...(metadata.data||[]).find(row=>row.event_id===event.event_id)}));}
export async function externalEventPlans(userId){const {data,error}=await supabase.from('referee_external_events').select('*').eq('user_id',userId);if(error)throw error;return data||[];}
export async function saveExternalEvent(userId,event,attendance){const result=attendance?await supabase.from('referee_external_events').upsert({user_id:userId,code:event.code,name:event.name,location:event.location||'',start_date:event.start||event.start_date||'',end_date:event.end||event.end_date||'',program:event.program||'',event_type:event.eventCategory||event.eventType||event.event_type||'',attendance}):await supabase.from('referee_external_events').delete().eq('user_id',userId).eq('code',event.code);if(result.error)throw result.error;}
export async function openExternalEvent(code){const {data,error}=await supabase.rpc('open_referee_external_event',{p_code:code});if(error)throw error;return data;}

export async function listRefereeMap(){const {data,error}=await supabase.rpc('list_referee_map');if(error)throw error;return data||[];}
export async function sendPortalFeedback(id,type,message){const {error}=await supabase.rpc('submit_referee_portal_feedback',{p_id:id,p_type:type,p_message:message});if(error)throw error;}

async function portalRpc(name,args){const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data;}
export const listMyInvitations=()=>portalRpc('list_my_referee_invitations');
export const listInviteEvents=()=>portalRpc('list_referee_invite_events');
export const listSentInvitations=eventId=>portalRpc('list_sent_referee_invitations',{p_event:eventId});
export const inviteReferee=(eventId,email)=>portalRpc('invite_referee',{p_event:eventId,p_email:email});
export const respondInvitation=(id,accept)=>portalRpc('respond_referee_invitation',{p_invitation:id,p_accept:accept});
export const listMyPortalFeedback=()=>portalRpc('list_my_referee_feedback');
export async function listBookmarks(userId){const {data,error}=await supabase.from('referee_bookmarks').select('*').eq('user_id',userId);if(error)throw error;return data||[];}
export async function saveBookmark(userId,event,enabled){
 const eventKey=event.code||event.event_key||event.id;const workspace=event.event_id||(/^[0-9a-f-]{36}$/i.test(event.id||'')?event.id:null);
 const result=enabled?await supabase.from('referee_bookmarks').upsert({user_id:userId,event_key:eventKey,event_id:workspace,code:event.code||'',name:event.name,location:event.location||'',start_date:event.start_date||event.start||'',end_date:event.end_date||event.end||'',program:event.program||'',event_type:event.eventCategory||event.event_type||event.eventType||event.format||''}):await supabase.from('referee_bookmarks').delete().eq('user_id',userId).eq('event_key',eventKey);
 if(result.error)throw result.error;return {event_key:eventKey,event_id:workspace,...event};
}
export async function signedProfilePhoto(path){if(!path)return '';const {data,error}=await supabase.storage.from('referee-profile-photos').createSignedUrl(path,3600);if(error)throw error;return data.signedUrl;}
export async function uploadProfilePhoto(userId,file){
 const {compressRobotPhoto}=await import('./photoCompression');
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPG or WebP photo.');
 const prepared=await compressRobotPhoto(file);const blob=await (await fetch(prepared.dataUrl)).blob();
 const path=`${userId}/${uuid()}.${prepared.mime==='image/webp'?'webp':'jpg'}`;
 const {error}=await supabase.storage.from('referee-profile-photos').upload(path,blob,{contentType:prepared.mime,upsert:false});if(error)throw error;return path;
}
export async function sendPortalFeedbackScreenshots(id,type,message,screenshots=[]){
 await sendPortalFeedback(id,type,message);
 if(!screenshots.length)return;
 const user=await accountUser();if(!user)throw Error('Sign in to attach screenshots.');
 const {data:registered,error:readError}=await supabase.from('referee_feedback_attachments').select('slot').eq('feedback_id',id);if(readError)throw readError;
 try{for(let slot=0;slot<screenshots.length;slot++){
  if((registered||[]).some(row=>row.slot===slot))continue;
  const shot=screenshots[slot],path=`${user.id}/${id}/${slot}.${shot.mime==='image/webp'?'webp':'jpg'}`;
  const {error}=await supabase.storage.from('referee-feedback-screenshots').upload(path,shot.blob,{contentType:shot.mime,upsert:false});
  if(error&&!/already exists|duplicate/i.test(error.message)&&String(error.statusCode)!=='409')throw error;
  await portalRpc('register_referee_feedback_screenshot',{p_id:id,p_slot:slot,p_path:path});
 }}catch{throw Error('Your message was saved, but a screenshot could not be attached. Keep this form open and press Send again to retry without duplicating the message.');}
}
export async function portalFeedbackScreenshots(id){const {data,error}=await supabase.from('referee_feedback_attachments').select('slot,path').eq('feedback_id',id).order('slot');if(error)throw error;return Promise.all((data||[]).map(async row=>{const {data:signed,error}=await supabase.storage.from('referee-feedback-screenshots').createSignedUrl(row.path,600);if(error)throw error;return {slot:row.slot,url:signed.signedUrl};}));}
