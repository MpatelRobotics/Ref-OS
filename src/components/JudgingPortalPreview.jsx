import React,{useEffect,useState} from 'react';
import * as portalApi from '../judgeGroupApi';
import JudgeGroupPortal from './JudgeGroupPortal';
import {AdvisorInterviewNotes} from './JudgeInterviewNotes';

export default function JudgingPortalPreview({eventId,eventName,groupRevision=0,api=portalApi}) {
 const [tab,setTab]=useState('advisor'),[groups,setGroups]=useState([]),[codes,setCodes]=useState([]),[label,setLabel]=useState(''),[mode,setMode]=useState('manual'),[group,setGroup]=useState(''),[issued,setIssued]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=async()=>{try{const[g,c]=await Promise.all([api.listJudgeGroupCodes(eventId),api.listJudgingPortalCodes(eventId)]);setGroups(g.filter(x=>x.enabled));setCodes(c);setError('');}catch(e){setError(e.message);}};
 useEffect(()=>{load();},[eventId,groupRevision,api]);
 const assignedGroup=groups.some(g=>g.name===group)?group:groups.length===1?groups[0].name:'';
 const create=async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const result=await api.createJudgingPortalCode(eventId,label,mode,assignedGroup);setIssued({...result,label});setLabel('');await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="space-y-4 rounded-2xl border border-indigo-300 p-4 dark:border-indigo-700">
  <h2 className="text-xl font-bold">Judge access & interview notes</h2><p>Issue individual judge codes and review private interview notes for this event.</p>
  {error&&<p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
  {tab==='group'?<JudgeGroupPortal eventId={eventId} eventName={eventName} preview onClose={()=>{setTab('advisor');load();}}/>:<>
   <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
    <label>Judge name or code label<input value={label} maxLength={100} disabled={busy} required onChange={e=>setLabel(e.target.value)} className="mt-1 min-h-[44px] w-full rounded border bg-transparent p-3"/></label>
    <label>Group assignment<select disabled={busy} value={mode} onChange={e=>setMode(e.target.value)} className="mt-1 min-h-[44px] w-full rounded border bg-transparent p-3"><option value="manual">JA assigns a group</option><option value="random">Random group on first login</option></select></label>
    {mode==='manual'&&<label>Assigned judge group<select value={assignedGroup} disabled={busy} required onChange={e=>setGroup(e.target.value)} className="mt-1 min-h-[44px] w-full rounded border bg-transparent p-3"><option value="">Choose a group</option>{groups.map(g=><option key={g.name}>{g.name}</option>)}</select></label>}
    <button disabled={busy||!groups.length} className="min-h-[44px] self-end rounded bg-indigo-700 p-3 font-semibold text-white disabled:opacity-50">{busy?'Creating code…':'Create individual judge code'}</button>
   </form>
   {!groups.length&&<p>Create a judge group above to issue individual codes.</p>}
   {issued&&<div role="status" className="rounded border border-indigo-400 p-3"><p>{issued.label} · Judge code: <code className="select-all font-mono font-bold">{issued.code}</code></p><p>Shown only now. Copy this code before creating another one.</p></div>}
   {codes.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"><p><b>{c.label}</b> · {c.group||'Group assigned at first login'} · {c.mode==='random'?'Random':'JA assigned'} · {c.enabled?'Enabled':'Disabled'}</p><button disabled={busy||!c.enabled} className="min-h-[44px] rounded border px-3" onClick={async()=>{setBusy(true);try{await api.disableJudgingPortalCode(eventId,c.id);await load();}catch(e){setError(e.message);}finally{setBusy(false);}}}>Disable code for {c.label}</button></div>)}
   <details className="rounded border p-3">
    <summary className="min-h-[44px] cursor-pointer py-2 font-semibold">Review interview notes</summary>
    <AdvisorInterviewNotes eventId={eventId}/>
   </details>
   <button type="button" className="min-h-[44px] rounded border px-4" onClick={()=>setTab('group')}>Preview judge view</button>
  </>}
 </section>;
}
