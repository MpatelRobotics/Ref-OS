import {supabase} from './supabaseClient';
export async function listOperations(eventId){
 const rows=[];for(let offset=0;offset<20000;offset+=1000){const {data,error}=await supabase.from('event_operations').select('*').eq('event_id',eventId).order('created_at').order('id').range(offset,offset+999);if(error)throw Error('Could not load event operations. Check access, connection and event-operations.sql.');rows.push(...data);if(data.length<1000)return rows;}throw Error('Too many operation records to load.');
}
export async function saveOperation(eventId,sessionId,division,kind,payload,row){
 const {data,error}=await supabase.rpc('save_event_operation',{p_event:eventId,p_session:sessionId||null,p_division:Number(division),p_kind:kind,p_payload:payload,p_id:row?.id||null,p_version:row?.version||0});if(error)throw Error(error.message);return data;
}
export function divisionCompletion(matches,divisions){return divisions.map(d=>{const rows=matches.filter(m=>Number(m.division_id??m.division??0)===Number(d.id));return {...d,total:rows.length,scored:rows.filter(m=>(m.red_score??m.redScore)!=null&&(m.blue_score??m.blueScore)!=null).length};});}
export function scopedOperations(rows,session,division){return rows.filter(r=>(r.session_id||null)===(session||null)&&(r.division_id===0||Number(r.division_id)===Number(division)));}
