export function localInterviewTime(iso) {
 const date=new Date(iso);if(!Number.isFinite(date.getTime()))return '';
 const pad=value=>String(value).padStart(2,'0');
 return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function validateInterviews(entries,duration=10) {
 if(!Number.isInteger(Number(duration))||Number(duration)<1||Number(duration)>120)return 'Interview length must be a whole number from 1 to 120 minutes.';
 if(entries.length>500)return 'Schedule up to 500 interviews.';
 const seen=new Set();
 for(const entry of entries){
  if(!entry.team||seen.has(entry.team))return 'Each team can have only one interview in this schedule.';
  seen.add(entry.team);
  if(!Number.isFinite(Date.parse(entry.start))||!Number.isInteger(Number(entry.minutes))||Number(entry.minutes)<1||Number(entry.minutes)>120)return 'Each interview needs a valid start time and a length from 1 to 120 minutes.';
  if(!entry.panel?.trim()||entry.panel.trim().length>100)return 'Enter a panel/location of up to 100 characters for each interview.';
 }
 for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
  const a=entries[i],b=entries[j];if(a.panel.trim().toLowerCase()!==b.panel.trim().toLowerCase())continue;
  const aStart=Date.parse(a.start),bStart=Date.parse(b.start);
  if(aStart<bStart+Number(b.minutes)*60000&&bStart<aStart+Number(a.minutes)*60000)return `Panel/location overlap: ${a.team} and ${b.team}. Adjust their times or assign different panels.`;
 }
 return '';
}
export function addInterviewSlots(existing,teams,start,minutes,panel) {
 const date=new Date(start),length=Number(minutes);
 if(!Number.isFinite(date.getTime()))throw Error('Choose a valid first interview time.');
 const error=validateInterviews([],length);if(error)throw Error(error);
 if(!panel.trim())throw Error('Enter a panel/location.');
 const scheduled=new Set(existing.map(entry=>entry.team));
 const selected=[...new Set(teams)].filter(team=>!scheduled.has(team)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 if(!selected.length)throw Error('Select at least one unscheduled team.');
 const next=[...existing,...selected.map((team,index)=>({id:crypto.randomUUID(),team,start:new Date(date.getTime()+index*length*60000).toISOString(),minutes:length,panel:panel.trim()}))];
 const issue=validateInterviews(next,length);if(issue)throw Error(issue);
 return next;
}
