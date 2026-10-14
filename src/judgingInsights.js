import {tmMatchIdentity} from './tmMatchIdentity.js';
export const languages=value=>String(value||'').split(/[,;]+/).map(s=>s.trim().toLowerCase()).filter(Boolean);
export function preparationConflicts(profiles,operations,teams){
 const group=name=>operations.find(o=>o.kind==='group'&&o.subject===name)?.value||{};
 const requests=Object.fromEntries(operations.filter(o=>o.kind==='team').map(o=>[o.subject,o.value]));
 return Object.fromEntries(profiles.map(p=>{const judges=group(p.name).judges||[];const supported=new Set(judges.flatMap(j=>languages(j.languages)));return [p.name.toLowerCase(),[...new Set([...(p.conflict_teams||[]),...teams.filter(t=>requests[t]?.language&&!supported.has(requests[t].language.trim().toLowerCase()))])]];}));
}
export function experienceSuggestions(groups){
 const judges=groups.flatMap(g=>(g.value?.judges||[]).map(j=>({...j,source:g.subject}))).filter(j=>j.name?.trim());const result=groups.map(g=>({name:g.subject,judges:[]}));
 for(const j of [...judges.filter(j=>j.experience==='experienced'),...judges.filter(j=>j.experience!=='experienced')]){const target=[...result].sort((a,b)=>a.judges.length-b.judges.length)[0];if(target)target.judges.push(j);}
 return result;
}
export function workloadEstimate(entries,completions={},duration=10,buffer=0,now=Date.now(),end){
 const pending=entries.filter(e=>!e.interviewed&&!completions[e.team]&&e.status!=='completed');const minutes=pending.reduce((n,e)=>n+Number(e.minutes||duration)+Number(e.buffer??buffer),0);const finish=now+minutes*60000;
 return {pending:pending.length,minutes,finish,behind:Number.isFinite(Date.parse(end))&&finish>Date.parse(end)};
}
export function matchDelayEstimates(settings,now=Date.now()){
 return settings.filter(s=>s.key.includes('tm_field_activity')).flatMap(s=>{const activity=s.value;if(!activity?.updatedAt||now-activity.updatedAt>90000)return [];const times=settings.find(t=>t.key===s.key.replace('tm_field_activity','tm_match_times'))?.value?.rows||[];return (activity.fieldSets||[]).filter(set=>set.connected).flatMap(set=>(set.fields||[]).filter(f=>f.status==='playing'&&f.startedAt).flatMap(field=>{const identity=tmMatchIdentity(field.match);const scheduled=times.find(t=>t.phase===identity?.phase&&Number(t.num)===identity?.num);const planned=Date.parse(scheduled?.scheduledAt);if(!Number.isFinite(planned))return [];return [{key:s.key+':'+set.id+':'+field.id,identity,field:field.name,set:set.name,minutes:Math.round((Number(field.startedAt)-planned)/60000)}];}));});
}
