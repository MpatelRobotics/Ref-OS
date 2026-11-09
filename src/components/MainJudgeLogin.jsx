import React,{useEffect,useState} from 'react';
import * as api from '../api';
import JudgeGroupPortal from './JudgeGroupPortal';

export default function MainJudgeLogin({service=api}) {
 const [events,setEvents]=useState([]),[query,setQuery]=useState(''),[selected,setSelected]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;service.listSelectableEvents().then(rows=>{if(live)setEvents(rows.filter(e=>!e.archivedAt));}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[service]);
 const event=events.find(e=>e.id===selected);
 if(event)return <JudgeGroupPortal key={event.id} eventId={event.id} eventName={event.name} preview publicLogin onClose={()=>setSelected('')}/>;
 return <main className="min-h-screen bg-slate-100 p-5 text-slate-900 dark:bg-slate-950 dark:text-white"><div className="mx-auto max-w-2xl space-y-4">
  <a href="/" className="inline-flex min-h-[44px] items-center underline">Back to Ref-OS</a><img src="/refos-logo.svg" alt="Ref-OS" className="h-16 w-16"/>
  <h1 className="text-3xl font-bold">Judge login</h1><p>Choose your event, then enter the individual judge code issued by the Judge Advisor. Your code opens only your assigned judge group.</p>
  <label className="block">Find your event<input value={query} onChange={e=>setQuery(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-xl border bg-transparent p-3"/></label>
  {loading&&<p role="status">Loading events…</p>}{error&&<p role="alert">{error}</p>}
  {events.filter(e=>e.name.toLowerCase().includes(query.toLowerCase())).map(e=><button key={e.id} onClick={()=>setSelected(e.id)} className="block min-h-[44px] w-full rounded-xl border bg-white p-4 text-left font-semibold text-slate-900 dark:bg-slate-800 dark:text-white">{e.name}</button>)}
  {!loading&&!events.length&&<p>No active events are available.</p>}
 </div></main>;
}
