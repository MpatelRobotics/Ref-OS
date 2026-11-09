import * as api from './api';
import {supabase} from './supabaseClient';

export async function loadJudgingWorkspace(eventId) {
 if(await api.getMyEventRole(eventId)!=='admin')throw Error('Event admin access is required for judging setup.');
 const [event,teams,settings,matches,sessions,nominations]=await Promise.all([
  api.getEvent(eventId,{strict:true}),
  supabase.from('teams').select('number,name').eq('event_id',eventId),
  supabase.from('event_settings').select('key,value').eq('event_id',eventId).or('key.eq.event_timezone,key.like.%tm_match_times%'),
  supabase.from('matches').select('phase,num,red,blue,red_score,blue_score,division_id,session_id').eq('event_id',eventId),
  api.listLeagueSessions(eventId),api.listNominations(eventId),
 ]);
 for(const r of [teams,settings,matches])if(r.error)throw r.error;
 if(!event||event.archivedAt)throw Error('This event is unavailable or archived.');
 return {event,teams:(teams.data||[]).sort((a,b)=>a.number.localeCompare(b.number,undefined,{numeric:true})),settings:settings.data||[],matches:matches.data||[],sessions,nominations};
}

// No violation tables or disciplinary subscriptions belong in the judging connector.
export function subscribeJudgingWorkspace(eventId,onChange,onStatus=()=>{}) {
 let channel=supabase.channel(`judging-${eventId}-${Math.random().toString(36).slice(2)}`);
 for(const table of ['nominations','judging_interview_schedules','teams','matches','event_settings']) {
  channel=channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`event_id=eq.${eventId}`},payload=>onChange(payload));
  channel=channel.on('postgres_changes',{event:'DELETE',schema:'public',table},payload=>onChange(payload));
 }
 channel.subscribe(onStatus);
 return ()=>supabase.removeChannel(channel);
}
