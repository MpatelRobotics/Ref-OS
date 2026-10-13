import React from 'react';
export default function ScheduledMatchTime({match,times=[],zone='UTC'}){
 const sameTeams=(a,b)=>[...(a||[])].sort().join('|')===[...(b||[])].sort().join('|');
 const row=times.find(r=>(r.phase||'qual')===(match.phase||'qual')&&Number(r.num)===Number(match.num)&&sameTeams(r.red,match.red)&&sameTeams(r.blue,match.blue));
 if(!row||!Number.isFinite(Date.parse(row.scheduledAt)))return null;
 let label;try{label=new Intl.DateTimeFormat('en-US',{timeZone:zone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(row.scheduledAt));}catch{return null;}
 return <span className="text-xs text-slate-600 dark:text-slate-300" title="Scheduled time from Tournament Manager; actual start may change">Scheduled <time dateTime={row.scheduledAt}>{label}</time></span>;
}
