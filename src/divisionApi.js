import { supabase } from './supabaseClient';
export const divisionSettingKey = (division, key, session) => `division:${division}:${key}${session ? '@'+session : ''}`;
const settingKeys = new Set(['qualification_records','rank_snapshot','tm_field_activity','division_alliances']);
const sameTeams = (a,b) => [...a].sort().join('|') === [...b].sort().join('|');
export function createDivisionApi(base, eventId, division, client = supabase) {
 if (!division) return base;
 const sid = base.leagueSessionFor(eventId);
 const scoped = query => {
  query=query.eq('event_id',eventId).eq('division_id',division);
  return sid?query.eq('session_id',sid):query.is('session_id',null);
 };
 const row = m => ({event_id:eventId,division_id:division,session_id:sid,phase:m.phase||'qual',num:Number(m.num),red:m.red||[],blue:m.blue||[],field:m.field||null,label:m.label||null,...(m.redScore!=null?{red_score:m.redScore}:{}),...(m.blueScore!=null?{blue_score:m.blueScore}:{}),...(m.winner?{winner:m.winner}:{})});
 const checked = async query => {const result=await query;if(result.error)throw result.error;return result.data;};
 const api={...base};
 api.listMatches=async()=>{
  const rows=await checked(scoped(client.from('matches').select('*')).order('num'));
  return (rows||[]).map(m=>({id:m.phase==='qual'?String(m.num):`${m.phase}-${m.num}`,phase:m.phase,num:m.num,divisionId:division,red:m.red||[],blue:m.blue||[],field:m.field||'',label:m.label||'',winner:m.winner||'',redScore:m.red_score,blueScore:m.blue_score}));
 };
 api.addMatch=async(_event,m)=>{await checked(client.from('matches').upsert(row(m),{onConflict:'event_id,session_key,division_id,phase,num'}));};
 api.insertTmMatch=async(_event,m)=>{const result=await client.from('matches').insert(row(m));if(result.error?.code==='23505')return false;if(result.error)throw result.error;return true;};
 const update=async(phase,num,value)=>checked(scoped(client.from('matches').update(value)).eq('phase',phase).eq('num',Number(num)));
 api.updateMatchScore=async(_event,phase,num,redScore,blueScore,winner)=>update(phase,num,{red_score:redScore,blue_score:blueScore,winner:winner||null});
 api.setMatchWinner=async(_event,phase,num,winner)=>update(phase,num,{winner:winner||null});
 api.deleteMatch=async(_event,phase,num)=>checked(scoped(client.from('matches').delete()).eq('phase',phase).eq('num',Number(num)));
 api.clearMatches=async()=>checked(scoped(client.from('matches').delete()));
 api.updateExistingVexScore=async(_event,m)=>{
  const query=scoped(client.from('matches').update({red_score:m.redScore,blue_score:m.blueScore,winner:m.redScore>m.blueScore?'red':m.blueScore>m.redScore?'blue':'tie'})).eq('phase',m.phase).eq('num',Number(m.num)).contains('red',m.existing.red).containedBy('red',m.existing.red).contains('blue',m.existing.blue).containedBy('blue',m.existing.blue).select('num');
  return (await checked(query)||[]).length;
 };
 api.listEventSettings=async()=>{
  const all=await base.listEventSettings(eventId);
  for(const key of settingKeys){const own=all[divisionSettingKey(division,key,sid)];if(own)all[key]={...own,key};else delete all[key];}
  return all;
 };
 api.upsertEventSetting=(event,key,value,by)=>base.upsertEventSetting(event,settingKeys.has(key)?divisionSettingKey(division,key,sid):key,value,by);
 api.getEventSetting=async(event,key)=>(await api.listEventSettings())[key]||null;
 api.deleteEventSetting=(event,key)=>base.deleteEventSetting(event,settingKeys.has(key)?divisionSettingKey(division,key,sid):key);
 api.bulkUpsertRankings=async(_event,rows)=>{
  const known=new Set((await base.listTeams(eventId)).map(t=>t.number));
  const missing=rows.filter(r=>!known.has(r.number));
  if(missing.length)await base.bulkUpsertTeams(eventId,missing.map(r=>({number:r.number,name:''})));
  await api.upsertEventSetting(eventId,'rank_snapshot',{ranks:Object.fromEntries(rows.map(r=>[r.number,r.rank])),importedAt:Date.now()});
  return rows.length;
 };
 api.listTeams=async()=>{
  const [teams,settings]=await Promise.all([base.listTeams(eventId),api.listEventSettings()]);
  const ranks=settings.rank_snapshot?.value?.ranks||{};
  return teams.map(t=>({...t,rank:ranks[t.number]??null}));
 };
 // Existing unassigned schedules are claimed only when both alliances match exactly.
 api.claimMatchingSchedule=async(scores)=>{
  const existing=await base.listMatches(eventId,{strict:true});
  for(const score of scores){
   const found=existing.filter(m=>m.phase===score.phase&&m.num===score.num&&sameTeams(m.red,score.red)&&sameTeams(m.blue,score.blue));
   if(found.length!==1)continue;
   const query=client.from('matches').update({division_id:division}).eq('event_id',eventId).eq('division_id',0).eq('phase',score.phase).eq('num',score.num).contains('red',score.red).containedBy('red',score.red).contains('blue',score.blue).containedBy('blue',score.blue);
   const result=await (sid?query.eq('session_id',sid):query.is('session_id',null));
   if(result.error && result.error.code!=='23505')throw result.error;
  }
 };
 api.buildViolationRow=(event,v)=>base.buildViolationRow(event,{...v,match:v.match?{...v.match,division}:null});
 api.listViolations=async()=> (await base.listViolations(eventId)).filter(v=>!v.match||v.match.division===division);
 api.addViolation=(event,v,photos)=>base.addViolation(event,{...v,match:v.match?{...v.match,division}:null},photos);
 const prefix=`d${division}:`;
 api.addFieldLog=(event,e)=>base.addFieldLog(event,{...e,matchId:e.matchId?prefix+e.matchId:null});
 api.listFieldLog=async()=> (await base.listFieldLog(eventId)).filter(e=>!e.matchId||e.matchId.startsWith(prefix)).map(e=>({...e,matchId:e.matchId?.slice(prefix.length)}));
 api.listFieldResetChecks=async()=> (await base.listFieldResetChecks(eventId)).filter(e=>e.matchId.startsWith(prefix)).map(e=>({...e,matchId:e.matchId.slice(prefix.length)}));
 api.verifyFieldResetQuadrant=(event,id,...args)=>base.verifyFieldResetQuadrant(event,prefix+id,...args);
 api.clearFieldResetMatch=(event,id)=>base.clearFieldResetMatch(event,prefix+id);
 api.clearFieldResetChecks=async()=>{for(const id of new Set((await api.listFieldResetChecks()).map(e=>e.matchId)))await api.clearFieldResetMatch(eventId,id);};
 api.listAlliances=async()=> (await api.listEventSettings()).division_alliances?.value?.rows || [];
 api.upsertAlliance=async(_event,seed,teams)=>{const rows=await api.listAlliances();const next=rows.filter(r=>r.seed!==Number(seed));next.push({seed:Number(seed),teams:teams||[]});await api.upsertEventSetting(eventId,'division_alliances',{rows:next.sort((a,b)=>a.seed-b.seed)});};
 api.clearAlliances=()=>api.deleteEventSetting(eventId,'division_alliances');
 api.clearRankings=()=>api.deleteEventSetting(eventId,'rank_snapshot');
 return api;
}
