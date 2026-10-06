import {supabase} from './supabaseClient';
const emptySession='00000000-0000-0000-0000-000000000000';
export async function loadInterviewSchedule(eventId,sessionId=null) {
 const {data,error}=await supabase.from('judging_interview_schedules').select('value,version').eq('event_id',eventId).eq('session_key',sessionId||emptySession).maybeSingle();
 if(error)throw Error('Could not load interviews. Check your connection, judging access, and interview-scheduler.sql setup.');
 return data||{value:{duration:10,entries:[]},version:0};
}
export async function saveInterviewSchedule(eventId,sessionId,value,version) {
 const {data,error}=await supabase.rpc('save_judging_interview_schedule',{p_event:eventId,p_session:sessionId||null,p_value:value,p_version:version});
 if(error){if(error.code==='40001')throw Error('Another organizer changed this schedule. Reload saved schedule before making more changes. Your draft is still here.');throw Error('Could not save interviews. Check your connection and Admin/Judge Advisor access. The draft is still here.');}
 return {value,version:data};
}
