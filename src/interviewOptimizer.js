import {validateInterviews} from './interviewSchedule.js';
import {assignConflictFreeGroups} from './judgeConflicts.js';

const minute=60000;
const numeric=(a,b)=>a.localeCompare(b,undefined,{numeric:true});
export function optimizeJudgeGroups({groupNames,panelPrefix=null,conflicts={},...options}){
 const names=groupNames.map(name=>name.trim());
 if(!names.length||names.some(n=>!n||n.length>100)||new Set(names.map(n=>n.toLowerCase())).size!==names.length)throw Error('Enter a unique name for each judge group.');
 const scheduled=new Set((options.existing||[]).map(r=>r.team));const teams=[...new Set(options.teams)].filter(t=>!scheduled.has(t)).sort(numeric);
 if(!teams.length)throw Error('Select at least one unscheduled team.');
 const allocation=assignConflictFreeGroups(teams,names,conflicts,options.existing||[]);
 const groups=allocation.groups.map((g,i)=>({...g,panel:panelPrefix?(names.length===1?panelPrefix:`${panelPrefix.trim()} ${i+1}`):g.name}));
 const entries=[],unplaced=[];let teamsWithTimes=0;
 for(const section of groups){if(!section.teams.length)continue;const result=optimizeInterviews({...options,teams:section.teams,existing:[...(options.existing||[]),...entries],panels:[section.panel],group:section.name});entries.push(...result.entries);unplaced.push(...result.unplaced);teamsWithTimes+=result.teamsWithTimes;section.unplaced=result.unplaced;}
 return {entries:entries.sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||numeric(a.team,b.team)),unplaced,teamsWithTimes,groups,conflictUnassigned:allocation.unassigned,uneven:allocation.uneven};
}
// Earliest feasible insertion, with the next match window as the tie-breaker.
// This is a scheduling heuristic, not a guarantee of a globally optimal schedule.
export function optimizeInterviews({teams,existing=[],matches=[],start,end,minutes=10,buffer=0,panels=['Judge panel 1'],group='',padding=10,lunchMode='off',lunchStart,lunchEnd,teamExtraMinutes={}}) {
 let from=Date.parse(start),until=Date.parse(end);const length=Number(minutes),gap=Number(buffer);
 const issue=validateInterviews(existing,length);if(issue)throw Error(issue);
 if(!Number.isFinite(from)||!Number.isFinite(until)||until<=from||until-from>7*24*60*minute)throw Error('Choose a start and end within a seven-day interview window.');
 if(!Number.isInteger(gap)||gap<0||gap>60)throw Error('Interview buffers must be 0–60 minutes.');
 if(!Number.isFinite(padding)||padding<0||padding>120)throw Error('Choose a valid match margin.');
 const locations=[...new Set(panels.map(p=>p.trim()))];if(!locations.length||locations.some(p=>!p||p.length>100)||new Set(locations.map(p=>p.toLowerCase())).size!==locations.length)throw Error('Choose distinct panels/locations.');
 const scheduled=new Set(existing.map(r=>r.team));const pending=[...new Set(teams)].filter(t=>!scheduled.has(t)).sort(numeric);
 if(!pending.length)throw Error('Select at least one unscheduled team.');if(pending.length+existing.length>500)throw Error('Schedule up to 500 interviews.');
 const lunch=[Date.parse(lunchStart),Date.parse(lunchEnd)];
 if(!['off','avoid','only'].includes(lunchMode))throw Error('Choose a valid lunch setting.');
 if(lunchMode!=='off'&&(!lunch.every(Number.isFinite)||lunch[1]<=lunch[0]))throw Error('Choose a valid lunch start and end.');
 if(lunchMode==='only'){from=Math.max(from,lunch[0]);until=Math.min(until,lunch[1]);}
 const lengths=new Map(pending.map(team=>[team,length+Number(teamExtraMinutes[team]||0)]));if([...lengths.values()].some(n=>!Number.isInteger(n)||n<1||n>120))throw Error('Interview length plus accommodations must be 1–120 minutes.');const proposed=[],unplaced=[];
 const teamBlocks=new Map(pending.map(team=>[team,matches.filter(m=>[...(m.red||[]),...(m.blue||[])].includes(team)&&Number.isFinite(Date.parse(m.scheduledAt))).map(m=>[Date.parse(m.scheduledAt)-padding*minute,Date.parse(m.scheduledAt)+padding*minute])]));
 const earliest=(team,panel)=>{const duration=(lengths.get(team)+gap)*minute;const blocks=[...(lunchMode==='avoid'?[lunch]:[]),...teamBlocks.get(team),...[...existing,...proposed].filter(r=>r.panel.trim().toLowerCase()===panel.toLowerCase()).map(r=>[Date.parse(r.start),Date.parse(r.start)+(Number(r.minutes)+Number(r.buffer||0))*minute])].sort((a,b)=>a[0]-b[0]);let time=from;for(const [a,b]of blocks){if(time+duration<=a)break;if(time<b&&a<time+duration)time=b;}return time+duration<=until?time:null;};
 while(pending.length){let best=null;for(const team of pending)for(const panel of locations){const time=earliest(team,panel);if(time===null)continue;const deadline=Math.min(...teamBlocks.get(team).filter(([a])=>a>=time+(lengths.get(team)+gap)*minute).map(([a])=>a));const candidate={team,panel,time,deadline};if(!best||time<best.time||time===best.time&&(deadline<best.deadline||deadline===best.deadline&&numeric(team,best.team)<0))best=candidate;}
  if(!best){unplaced.push(...pending);break;}
  proposed.push({id:crypto.randomUUID(),team:best.team,panel:best.panel,start:new Date(best.time).toISOString(),minutes:lengths.get(best.team),buffer:gap,group,status:'scheduled'});pending.splice(pending.indexOf(best.team),1);
 }
 return {entries:proposed,unplaced,ignored:teams.filter(t=>scheduled.has(t)),teamsWithTimes:teams.filter(t=>(teamBlocks.get(t)||[]).length).length};
}
