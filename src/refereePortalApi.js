import {supabase} from './supabaseClient';
export async function accountUser(){const {data,error}=await supabase.auth.getUser();if(error && error.name!=='AuthSessionMissingError')throw error;return data?.user && !data.user.is_anonymous?data.user:null;}
export async function loadRefereeProfile(userId){
 const [profile,plans]=await Promise.all([supabase.from('referee_profiles').select('*').eq('user_id',userId).maybeSingle(),supabase.from('referee_event_plans').select('event_id,attendance').eq('user_id',userId)]);
 if(profile.error)throw profile.error;if(plans.error)throw plans.error;
 return {profile:profile.data,plans:plans.data||[]};
}
export async function saveRefereeProfile(userId,profile){const {error}=await supabase.from('referee_profiles').upsert({...profile,user_id:userId});if(error)throw error;}
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
export async function refereeEventCatalog(){const {data,error}=await supabase.rpc('list_referee_event_catalog');if(error)throw error;return data||[];}
export async function externalEventPlans(userId){const {data,error}=await supabase.from('referee_external_events').select('*').eq('user_id',userId);if(error)throw error;return data||[];}
export async function saveExternalEvent(userId,event,attendance){const result=attendance?await supabase.from('referee_external_events').upsert({user_id:userId,code:event.code,name:event.name,location:event.location||'',start_date:event.start||event.start_date||'',attendance}):await supabase.from('referee_external_events').delete().eq('user_id',userId).eq('code',event.code);if(result.error)throw result.error;}
export async function openExternalEvent(code){const {data,error}=await supabase.rpc('open_referee_external_event',{p_code:code});if(error)throw error;return data;}

export async function listRefereeMap(){const {data,error}=await supabase.rpc('list_referee_map');if(error)throw error;return data||[];}
export async function sendPortalFeedback(id,type,message){const {error}=await supabase.rpc('submit_referee_portal_feedback',{p_id:id,p_type:type,p_message:message});if(error)throw error;}
