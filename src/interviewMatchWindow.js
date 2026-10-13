export function interviewMatchWindow(entry,matches=[]){
 const teamMatches=matches.filter(m=>[...(m.red||[]),...(m.blue||[])].includes(entry.team));
 const timed=teamMatches.filter(m=>Number.isFinite(Date.parse(m.scheduledAt))).sort((a,b)=>Date.parse(a.scheduledAt)-Date.parse(b.scheduledAt));
 const start=Date.parse(entry.start),end=start+Number(entry.minutes)*60000;
 const after=timed.filter(m=>Date.parse(m.scheduledAt)<=start).at(-1)||null;
 const before=timed.find(m=>Date.parse(m.scheduledAt)>=end)||null;
 const overlapping=timed.filter(m=>Date.parse(m.scheduledAt)>start&&Date.parse(m.scheduledAt)<end);
 return {after,before,overlapping,unknown:teamMatches.length-timed.length,known:timed.length};
}
export function interviewMatchLabel(match){
 if(match.label)return match.label;
 const prefixes={qual:'Q',practice:'P',r16:'R16',qf:'QF',sf:'SF',final:'F',f:'F'};
 if(['r16','qf','sf'].includes(match.phase))return `${prefixes[match.phase]}${tmPairingNumber(match.phase,match.num)}-${tmGameNumber(match.phase,match.num)}`;
 return `${prefixes[match.phase]||match.phase||'Match'}${match.num??''}`;
}
export function groupOptimizerEntries(entries){
 const groups=new Map();for(const entry of entries){const group=entry.group?.trim()||'Unassigned judge group';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(entry);}
 return [...groups].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})).map(([name,rows])=>({name,entries:[...rows].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||a.team.localeCompare(b.team,undefined,{numeric:true}))}));
}
import {tmPairingNumber,tmGameNumber} from './tmMatchIdentity.js';
