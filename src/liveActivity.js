import {supabase} from './supabaseClient';
export async function reportLiveActivity(device,event,session,name,screen,activity,visible){
 const {error}=await supabase.rpc('report_live_activity',{p_device:device,p_event:event,p_session:session||null,p_name:name,p_screen:screen,p_activity:activity,p_visible:visible});if(error)throw error;
}
export async function removeLiveActivity(device){await supabase.rpc('remove_live_activity',{p_device:device});}
export async function listLiveActivity(){const {data,error}=await supabase.rpc('list_developer_live_activity');if(error)throw Error('Could not load live activity. Check Developer access, connection, and developer-live-activity.sql setup.');return data||[];}
