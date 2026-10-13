import {interviewTimeToUTC} from './interviewSchedule.js';
export function isTmTimesOnlyTable(table){const h=(table[0]||[]).map(v=>String(v).toLowerCase().replace(/[^a-z0-9]/g,''));return h.includes('matchnumber')&&h.includes('timescheduled')&&!h.some(k=>/^(red|blue)[0-9]+$/.test(k));}
export function parseTmTimesOnly(table,matches,{zone='UTC'}={}){
 const h=table[0].map(v=>String(v).toLowerCase().replace(/[^a-z0-9]/g,'')),matchCol=h.indexOf('matchnumber'),timeCols=h.map((v,i)=>v==='timescheduled'?i:-1).filter(i=>i>=0);const rows=[],warnings=[];let unmatched=0;
 for(const row of table.slice(1)){
 const label=String(row[matchCol]||'').trim().toUpperCase();const parts=label.match(/^(Q|P|R16|QF|SF|F)\s*(\d+)(?:-(\d+))?$/);if(!parts){unmatched++;continue;}
 const phase={Q:'qual',P:'practice',R16:'r16',QF:'qf',SF:'sf',F:'final'}[parts[1]];const pairing=Number(parts[2]),game=Number(parts[3]||1);const num=['r16','qf','sf'].includes(phase)?(game-1)*1000+pairing:pairing;
 const candidates=matches.filter(m=>(m.phase||'qual')===phase&&Number(m.num)===num);if(candidates.length!==1){unmatched++;continue;}
 let scheduledAt=null;for(const col of timeCols){try{scheduledAt=parseManualScheduledTime(row[col],{zone});if(scheduledAt)break;}catch{}}
 if(!scheduledAt){warnings.push(`No valid scheduled time for ${label}; skipped.`);continue;}
 const m=candidates[0];rows.push({phase,num,red:m.red||[],blue:m.blue||[],scheduledAt});
 }
 if(unmatched)warnings.push(`${unmatched} match labels did not match an existing Ref OS match. Import the match list first and select the correct division/session.`);
 const keys=rows.map(r=>`${r.phase}:${r.num}`);if(new Set(keys).size!==keys.length)throw Error('Repeated match labels in the time export. Remove ambiguous duplicates before importing.');
 return {rows,warnings,unmatched};
}
export function parseManualScheduledTime(value,{date='',zone='UTC'}={}){
 const text=String(value??'').trim();if(!text||value===0)return null;
 if(/^\d{10,13}$/.test(text)){const n=Number(text),ms=text.length===13?n:n*1000;if(!Number.isFinite(new Date(ms).getTime()))throw Error('Invalid timestamp');return new Date(ms).toISOString();}
 if(/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)){if(!Number.isFinite(Date.parse(text)))throw Error('Invalid timestamp');return new Date(text).toISOString();}
 let clock=text;const combined=text.match(/^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})[T\s]+(.+)$/);if(combined){date=combined[1];clock=combined[2];}
 const parts=clock.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);if(!parts)throw Error('Invalid scheduled time');
 if(!date)throw Error('Schedule date required');const us=date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(us)date=`${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00Z'))||new Date(date+'T00:00Z').toISOString().slice(0,10)!==date)throw Error('Invalid schedule date');
 let hour=Number(parts[1]);const min=Number(parts[2]),sec=Number(parts[3]||0);if(min>59||sec>59||hour>(parts[4]?12:23)||(parts[4]&&hour<1))throw Error('Invalid scheduled time');if(parts[4])hour=hour%12+(parts[4].toUpperCase()==='PM'?12:0);
 const iso=interviewTimeToUTC(`${date}T${String(hour).padStart(2,'0')}:${parts[2]}`,zone);return new Date(Date.parse(iso)+sec*1000).toISOString();
}
export function mergeManualMatchTimes(existing,incoming){
 const key=r=>`${r.phase||'qual'}:${Number(r.num)}`;const rows=new Map(existing.map(r=>[key(r),r]));
 const teams=r=>JSON.stringify([[...(r.red||[])].sort(),[...(r.blue||[])].sort()]);
 for(const row of incoming){const prior=rows.get(key(row));if(row.scheduledAt)rows.set(key(row),{phase:row.phase,num:row.num,red:row.red,blue:row.blue,scheduledAt:row.scheduledAt});else if(row.timeInvalid||prior&&teams(prior)!==teams(row))rows.delete(key(row));}
 return [...rows.values()];
}
