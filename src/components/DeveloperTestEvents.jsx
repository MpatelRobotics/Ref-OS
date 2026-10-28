import React,{useEffect,useState} from 'react';
import * as api from '../api';
const button='min-h-[44px] rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50 dark:border-slate-600';
const input='mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-transparent p-2 dark:border-slate-600';
export default function DeveloperTestEvents({onOpen,service=api}){
 const [events,setEvents]=useState([]),[name,setName]=useState('Developer Test Event'),[code,setCode]=useState(''),[format,setFormat]=useState('tournament'),[samples,setSamples]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);try{setEvents(await service.listDeveloperTestEvents());setError('');}catch(e){setError(e.message);}finally{setLoading(false);}};
 useEffect(()=>{let live=true;service.listDeveloperTestEvents().then(rows=>{if(live)setEvents(rows);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[service]);
 const open=async event=>{setBusy(true);setError('');try{await service.openDeveloperTestEvent(event.id);onOpen(event.id);}catch(e){setError(e.message);}finally{setBusy(false);}};
 const create=async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const event=await service.createDeveloperTestEvent(name,code,format,samples);setCode('');setEvents(rows=>[event,...rows]);}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="mb-4 rounded-xl border border-indigo-300 bg-white p-4 space-y-3 text-slate-900 dark:border-indigo-700 dark:bg-slate-800 dark:text-slate-100">
  <h2 className="text-lg font-bold">Private test events</h2><p className="text-sm text-slate-600 dark:text-slate-300">Only developers can see or open these events. They never appear in the public event list. Normal event features are available for testing.</p>
  {error&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  <details><summary className="min-h-[44px] cursor-pointer py-2 font-semibold">Create a private test event</summary>
   <form onSubmit={create} className="space-y-3 pt-2">
    <label className="block text-sm font-semibold">Test event name<input className={input} value={name} onChange={e=>setName(e.target.value)} minLength={3} maxLength={160} required disabled={busy}/></label>
    <label className="block text-sm font-semibold">Event format<select className={input} value={format} onChange={e=>setFormat(e.target.value)} disabled={busy}><option value="tournament">Tournament</option><option value="league">League</option></select></label>
    <label className="block text-sm font-semibold">Event Admin code<input className={input+' font-mono'} type="password" autoComplete="new-password" autoCapitalize="characters" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={4} pattern="[0-9][A-Z][0-9][0-9]" placeholder="Number, letter, two numbers" required disabled={busy}/></label>
    <p className="text-xs text-slate-500">Developer access is still required, even if someone knows this code.</p>
    <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={samples} onChange={e=>setSamples(e.target.checked)} disabled={busy}/> Include 32 fictional test teams</label>
    <button className={button+' bg-indigo-700 text-white'} disabled={busy||name.trim().length<3||!/^\d[A-Z]\d{2}$/.test(code)}>{busy?'Working…':'Create Test Event'}</button>
   </form>
  </details>
  {loading?<p className="text-sm">Loading test events…</p>:events.length===0?<p className="text-sm text-slate-500">No private test events yet.</p>:events.map(event=><article key={event.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><h3 className="font-semibold">{event.name}</h3><p className="text-xs text-slate-500">Private · {event.format==='league'?'League':'Tournament'}{event.archivedAt?' · Archived':''}</p><button className={button+' mt-2'} disabled={busy} onClick={()=>open(event)}>Open Test Event</button></article>)}
  <button className={button+' text-sm'} onClick={load} disabled={busy||loading}>Refresh Test Events</button>
 </section>;
}
