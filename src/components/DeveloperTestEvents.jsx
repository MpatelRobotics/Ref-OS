import React,{useEffect,useState} from 'react';
import * as api from '../api';
const button='min-h-[44px] rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50 dark:border-slate-600';
const input='mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-transparent p-2 dark:border-slate-600';
export default function DeveloperTestEvents({onOpen,onDeleted,service=api}){
 const [events,setEvents]=useState([]),[name,setName]=useState('Developer Test Event'),[format,setFormat]=useState('tournament'),[samples,setSamples]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);try{setEvents(await service.listDeveloperTestEvents());setError('');}catch(e){setError(e.message);}finally{setLoading(false);}};
 useEffect(()=>{let live=true;service.listDeveloperTestEvents().then(rows=>{if(live)setEvents(rows);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[service]);
 const open=async event=>{setBusy(true);setError('');try{await service.openDeveloperTestEvent(event.id);onOpen(event.id);}catch(e){setError(e.message);}finally{setBusy(false);}};
 const create=async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const event=await service.createDeveloperTestEvent(name,format,samples);setEvents(rows=>[event,...rows]);}catch(e){setError(e.message);}finally{setBusy(false);}};
 const remove=async event=>{if(!window.confirm('Permanently delete "'+event.name+'" and all of its test data? This cannot be undone.'))return;setBusy(true);setError('');try{await service.deleteDeveloperTestEvent(event.id,event.name);setEvents(rows=>rows.filter(row=>row.id!==event.id));onDeleted?.(event.id);}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="mb-4 rounded-xl border border-indigo-300 bg-white p-4 space-y-3 text-slate-900 dark:border-indigo-700 dark:bg-slate-800 dark:text-slate-100">
  <h2 className="text-lg font-bold">Private test events</h2><p className="text-sm text-slate-600 dark:text-slate-300">Only developers can see or open these events. They never appear in the public event list. No event passcode is needed. Normal event features are available for testing.</p>
  {error&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  <details><summary className="min-h-[44px] cursor-pointer py-2 font-semibold">Create a private test event</summary>
   <form onSubmit={create} className="space-y-3 pt-2">
    <label className="block text-sm font-semibold">Test event name<input className={input} value={name} onChange={e=>setName(e.target.value)} minLength={3} maxLength={160} required disabled={busy}/></label>
    <label className="block text-sm font-semibold">Event format<select className={input} value={format} onChange={e=>setFormat(e.target.value)} disabled={busy}><option value="tournament">Tournament</option><option value="league">League</option></select></label>
    <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={samples} onChange={e=>setSamples(e.target.checked)} disabled={busy}/> Include 32 fictional test teams</label>
    <button className={button+' bg-indigo-700 text-white'} disabled={busy||name.trim().length<3}>{busy?'Working…':'Create Test Event'}</button>
   </form>
  </details>
  {loading?<p className="text-sm">Loading test events…</p>:events.length===0?<p className="text-sm text-slate-500">No private test events yet.</p>:events.map(event=><article key={event.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><h3 className="font-semibold">{event.name}</h3><p className="text-xs text-slate-500">Private · {event.format==='league'?'League':'Tournament'}{event.archivedAt?' · Archived':''}</p><div className="mt-2 flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={()=>open(event)}>Open Test Event</button><button className={button+' text-red-700 dark:text-red-300'} disabled={busy} onClick={()=>remove(event)}>Delete Test Event</button></div></article>)}
  <button className={button+' text-sm'} onClick={load} disabled={busy||loading}>Refresh Test Events</button>
 </section>;
}
