import React,{useEffect,useState} from 'react';
import * as scheduleApi from '../interviewScheduleApi';
export default function JudgingProgress({eventId,sessionId,teams,revision=0,api=scheduleApi}){
 const [value,setValue]=useState(null),[error,setError]=useState('');
 const refresh=async()=>{try{const result=await api.loadInterviewSchedule(eventId,sessionId);setValue(result.value);setError('');}catch(e){setError(e.message);}};
 useEffect(()=>{refresh();const timer=setInterval(refresh,15000);return()=>clearInterval(timer);},[eventId,sessionId,api,revision]);
 const assigned=new Map();for(const g of value?.groups||[])for(const team of g.teams||[])assigned.set(team,g.name);for(const r of value?.entries||[])assigned.set(r.team,r.group||'Unassigned judge group');
 const done=team=>Boolean(value?.completions?.[team])||(value?.entries||[]).some(r=>r.team===team&&r.status==='completed');
 const names=[...new Set(assigned.values())].sort();const completed=[...assigned.keys()].filter(done).length;
 return <details className="mb-5 rounded-xl border bg-white p-4 dark:bg-slate-800"><summary className="min-h-[44px] cursor-pointer font-bold">Universal interview tracker · {completed}/{assigned.size} interviewed</summary><p className="my-3 text-sm">Saved progress across all judge groups in this event/session. Refreshes every 15 seconds while this page is open.</p>{error&&<p role="alert" className="text-red-700">{error}</p>}<button className="min-h-[44px] rounded border px-3" onClick={refresh}>Refresh interview progress</button>{value&&!assigned.size&&<p>No saved group assignments yet.</p>}{names.map(name=>{const list=[...assigned].filter(([,g])=>g===name).map(([team])=>team).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));return <section key={name} className="my-3 rounded border p-3"><h3 className="font-bold">{name} · {list.filter(done).length}/{list.length} interviewed</h3><ul className="space-y-2">{list.map(team=><li key={team} className={done(team)?'rounded bg-green-50 p-2 text-green-900':'rounded border p-2'}>{team} · {teams.find(t=>t.number===team)?.name||'Team'} · <b>{done(team)?'Interviewed':'Pending interview'}</b></li>)}</ul></section>;})}</details>;
}
