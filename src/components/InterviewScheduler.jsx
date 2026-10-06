import React,{useEffect,useMemo,useRef,useState} from 'react';
import * as scheduleApi from '../interviewScheduleApi';
import {addInterviewSlots,localInterviewTime,interviewTimeToUTC,validateInterviews} from '../interviewSchedule';

export default function InterviewScheduler({eventId,sessionId=null,sessionName='',teams,eventTimezone='UTC',onSaveTimezone,api=scheduleApi}) {
 const [entries,setEntries]=useState([]),[duration,setDuration]=useState(10),[start,setStart]=useState(''),[panel,setPanel]=useState('Judge panel 1'),[selected,setSelected]=useState([]);
 const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const version=useRef(0),flight=useRef(false);
 const zone=eventTimezone;
 const zones=[
  ['America/New_York','Eastern (EST / EDT)'],
  ['America/Chicago','Central (CST / CDT)'],
  ['America/Denver','Mountain (MST / MDT)'],
  ['America/Phoenix','Arizona (MST — no daylight saving)'],
  ['America/Los_Angeles','Pacific (PST / PDT)'],
  ['America/Anchorage','Alaska (AKST / AKDT)'],
  ['America/Adak','Aleutian (HST / HDT)'],
  ['Pacific/Honolulu','Hawaii (HST — no daylight saving)'],
 ];
 const zoneLabel=zones.find(([value])=>value===zone)?.[1] || 'Not set (currently UTC)';
 const sortedTeams=useMemo(()=>[...teams].sort((a,b)=>a.number.localeCompare(b.number,undefined,{numeric:true})),[teams]);
 useEffect(()=>{let live=true;api.loadInterviewSchedule(eventId,sessionId).then(result=>{if(!live)return;setEntries(result.value.entries||[]);setDuration(result.value.duration||10);version.current=result.version;setLoaded(true);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[eventId,sessionId,api]);
 const reload=async()=>{if(flight.current||dirty&&!confirm('Discard your unsaved interview changes and reload the saved schedule?'))return;flight.current=true;setBusy(true);setError('');try{const result=await api.loadInterviewSchedule(eventId,sessionId);setEntries(result.value.entries||[]);setDuration(result.value.duration||10);version.current=result.version;setLoaded(true);setDirty(false);setSelected([]);setMessage('Saved schedule loaded.');}catch(e){setError(e.message);}finally{flight.current=false;setBusy(false);}};
 const changed=()=>{setDirty(true);setMessage('');setError('');};
 const add=()=>{try{setEntries(addInterviewSlots(entries,selected,interviewTimeToUTC(start,zone),duration,panel));setSelected([]);changed();}catch(e){setError(e.message);}};
 const update=(id,patch)=>{setEntries(old=>old.map(entry=>entry.id===id?{...entry,...patch}:entry));changed();};
 const issue=validateInterviews(entries,duration);
 const save=async()=>{if(flight.current||issue)return;flight.current=true;setBusy(true);setError('');try{const result=await api.saveInterviewSchedule(eventId,sessionId,{duration:Number(duration),entries},version.current);version.current=result.version;setDirty(false);setMessage('Interview schedule saved for staff in this event/session.');}catch(e){setError(e.message);}finally{flight.current=false;setBusy(false);}};
 const scheduled=new Set(entries.map(entry=>entry.team));
 return <section aria-label="Experimental Interview Scheduler" className="mb-5 space-y-4 rounded-xl border border-amber-300 bg-white p-4 dark:bg-slate-800">
  <div><h3 className="font-bold">Interview Scheduler <span className="rounded bg-amber-100 px-2 py-1 text-sm text-amber-900">Experimental</span></h3><p className="mt-2 text-sm">Shared with Admin and Judge Advisor only. {sessionName?`Schedule for ${sessionName}. `:''}Review times before using them. Match-time conflicts are not checked because imported matches do not include scheduled times. No invitations or notifications are sent.</p></div>
  <p className="text-sm">Times use the event timezone: <b>{zoneLabel}</b>. Daylight saving is applied automatically where observed. Interview length applies to new slots; existing slots can be edited individually.</p>
  {onSaveTimezone&&<label className="block text-sm">Event timezone<select value={zone} disabled={busy} className="ml-2 min-h-[44px] rounded border bg-transparent p-2" onChange={async e=>{setBusy(true);try{await onSaveTimezone(e.target.value);setStart('');setError('');}catch(err){setError('Could not save the event timezone. Try again.');}finally{setBusy(false);}}}>{!zones.some(([value])=>value===zone)&&<option value={zone} disabled>Select a U.S. timezone</option>}{zones.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
  {error&&<p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}{message&&<p role="status">{message}</p>}
  {!loaded&&!error&&<p role="status">Loading interview schedule…</p>}
  <fieldset disabled={!loaded||busy} className="space-y-3"><legend className="font-semibold">Plan interviews</legend>
   <div className="grid gap-3 sm:grid-cols-3"><label>Interview length (minutes)<input type="number" min="1" max="120" step="1" value={duration} onChange={e=>{setDuration(e.target.value);changed();}} className="block min-h-[44px] w-full rounded-lg border bg-transparent p-2"/></label><label>First interview time<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} className="block min-h-[44px] w-full min-w-0 rounded-lg border bg-transparent p-2"/></label><label>Panel/location<input maxLength={100} value={panel} onChange={e=>setPanel(e.target.value)} className="block min-h-[44px] w-full rounded-lg border bg-transparent p-2"/></label></div>
   <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setSelected(sortedTeams.filter(team=>!scheduled.has(team.number)).map(team=>team.number))} className="min-h-[44px] rounded-lg border px-3">Select unscheduled teams</button><button type="button" onClick={()=>setSelected([])} className="min-h-[44px] rounded-lg border px-3">Clear selection</button></div>
   <div className="grid max-h-52 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">{sortedTeams.map(team=><label key={team.number} className="flex min-h-[44px] items-center gap-2 rounded border p-2"><input type="checkbox" disabled={scheduled.has(team.number)} checked={selected.includes(team.number)} onChange={e=>setSelected(old=>e.target.checked?[...old,team.number]:old.filter(number=>number!==team.number))}/><span>{team.number} · {team.name||'Team'}{scheduled.has(team.number)?' (scheduled)':''}</span></label>)}</div>
   {!teams.length&&<p>Add teams to the event before scheduling interviews.</p>}
   <button type="button" onClick={add} disabled={!selected.length} className="min-h-[44px] rounded-lg border px-3 font-semibold">Add selected interviews</button>
  </fieldset>
  {issue&&<p role="alert" className="text-red-700 dark:text-red-300">{issue}</p>}
  <div className="space-y-3">{[...entries].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)).map(entry=><fieldset key={entry.id} disabled={busy||!loaded} className="rounded-lg border p-3"><legend className="px-1 font-bold">Team {entry.team}</legend><div className="grid gap-3 sm:grid-cols-3"><label>Start<input type="datetime-local" value={localInterviewTime(entry.start,zone)} onChange={e=>{try{update(entry.id,{start:interviewTimeToUTC(e.target.value,zone)});}catch(err){setError(err.message);}}} className="block min-h-[44px] w-full min-w-0 rounded border bg-transparent p-2"/></label><label>Length (minutes)<input type="number" min="1" max="120" step="1" value={entry.minutes} onChange={e=>update(entry.id,{minutes:Number(e.target.value)})} className="block min-h-[44px] w-full rounded border bg-transparent p-2"/></label><label>Panel/location<input maxLength={100} value={entry.panel} onChange={e=>update(entry.id,{panel:e.target.value})} className="block min-h-[44px] w-full rounded border bg-transparent p-2"/></label></div><p className="my-2 text-sm">Ends {Number.isFinite(Date.parse(entry.start))?new Date(Date.parse(entry.start)+Number(entry.minutes)*60000).toLocaleString(undefined,{timeZone:zone}):'—'}</p><button type="button" onClick={()=>{setEntries(old=>old.filter(row=>row.id!==entry.id));changed();}} className="min-h-[44px] rounded border px-3">Remove interview</button></fieldset>)}</div>
  {loaded&&!entries.length&&<p>No interviews scheduled yet.</p>}
  <div className="flex flex-wrap gap-3"><button type="button" disabled={!loaded||busy||!dirty||Boolean(issue)} onClick={save} className="min-h-[44px] rounded-lg bg-sky-800 px-4 text-white">{busy?'Working…':'Save interview schedule'}</button><button type="button" disabled={busy} onClick={reload} className="min-h-[44px] rounded-lg border px-3">Reload saved schedule</button>{dirty&&<span className="self-center text-sm">Unsaved changes · Save before leaving Judging</span>}</div>
 </section>;
}
