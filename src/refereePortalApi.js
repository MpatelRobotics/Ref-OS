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
