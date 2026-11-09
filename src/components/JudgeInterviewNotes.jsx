import React,{useEffect,useRef,useState} from 'react';
import * as portalApi from '../judgeGroupApi';
import useUnsavedWork from '../unsavedWork';
import {formatInterviewDisplay} from '../interviewSchedule';

export function TeamInterviewTime({entry,zone,onClose}) {
 const dialog=useRef(null);
 useEffect(()=>{dialog.current.showModal();},[]);
 return <dialog ref={dialog} onCancel={e=>{e.preventDefault();onClose();}} aria-labelledby="team-interview-time" className="w-[calc(100%_-_2rem)] max-w-lg rounded-2xl bg-white p-6 text-center text-slate-900 backdrop:bg-slate-950">
  <p className="text-lg font-semibold">Team {entry.team}</p><h2 id="team-interview-time" className="my-4 text-3xl font-bold">{entry.start?formatInterviewDisplay(entry.start,zone):'Time not scheduled yet'}</h2>
  <p>{zone}</p><p className="mt-3">{entry.group} · {entry.minutes} minute interview</p>
  <p className="mt-2">{entry.panel && `Location: ${entry.panel}`}</p>
  <button autoFocus className="mt-6 min-h-[44px] rounded-xl border px-5" onClick={onClose}>Back to judge portal</button>
 </dialog>;
}

export default function JudgeInterviewNotes({eventId,entry,record=null,onSaved,saveNotes=portalApi.saveJudgingInterviewNotes}) {
 const [notes,setNotes]=useState(record?.notes||''),[version,setVersion]=useState(record?.version||0),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useUnsavedWork(dirty);
 useEffect(()=>{if(!dirty&&(record?.version||0)>=version){setNotes(record?.notes||'');setVersion(record?.version||0);}},[record?.version,record?.notes,dirty,version]);
 const save=async()=>{
  if(busy)return;setBusy(true);setError('');setMessage('');
  try{const v=await saveNotes({p_event:eventId,p_session:entry.session_id||null,p_team:entry.team,p_notes:notes,p_version:version});
   setVersion(v);setDirty(false);setMessage('Interview notes saved.');await onSaved?.();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <section className="space-y-2 rounded-xl border p-3"><h4 className="font-bold">Private interview notes</h4><p className="text-sm">For this judge group and the Judge Advisor. Notes are deleted with the event.</p>
  <label className="block">Notes for {entry.team}<textarea value={notes} maxLength={20000} disabled={busy} onChange={e=>{setNotes(e.target.value);setDirty(true);setMessage('');}} className="mt-1 min-h-[140px] w-full rounded border bg-transparent p-3"/></label>
  {record?.version>version&&dirty&&<p role="status">Newer notes are available. Save will check for changes before replacing them.</p>}
  <button disabled={busy||!dirty} onClick={save} className="min-h-[44px] rounded border px-4 disabled:opacity-50">{busy?'Saving notes…':'Save interview notes'}</button>
  {dirty&&<p className="text-sm">Unsaved notes</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
  {error&&<button disabled={busy} className="min-h-[44px] rounded border px-4" onClick={async()=>{if(!confirm('Reload saved notes and discard your unsaved edits?'))return;try{await onSaved?.();setVersion(0);setDirty(false);setError('');}catch(e){setError(e.message);}}}>Reload saved notes</button>}
 </section>;
}

export function AdvisorInterviewNotes({eventId,loadNotes=portalApi.listJudgingInterviewNotes}) {
 const [rows,setRows]=useState([]),[query,setQuery]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{setBusy(true);try{setRows(await loadNotes(eventId,true));setError('');}catch(e){setError(e.message);}finally{setBusy(false);}};
 useEffect(()=>{load();},[eventId]);
 return <section className="space-y-3 rounded-xl border p-4"><h3 className="text-xl font-bold">Judge Advisor · Interview notes</h3><p>Private notes across all groups. Deleted automatically when the event is deleted.</p>
  <button onClick={load} disabled={busy} className="min-h-[44px] rounded border px-4">Refresh interview notes</button>
  <label className="block">Find team or judge group<input value={query} onChange={e=>setQuery(e.target.value)} className="mt-1 min-h-[44px] w-full rounded border bg-transparent p-3"/></label>
  {error&&<p role="alert">{error}</p>}{!rows.length&&!busy&&<p>No interview notes saved yet.</p>}
  {rows.filter(r=>(r.team+' '+r.group).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.team.localeCompare(b.team,undefined,{numeric:true})).map(r=><article key={`${r.session_id}:${r.group}:${r.team}`} className="rounded border p-3"><h4 className="font-bold">{r.team} · {r.group}</h4><p className="text-sm">{r.session_id?'League session':'Tournament'} · Updated {new Date(r.updated_at).toLocaleString()}</p><p className="mt-2 whitespace-pre-wrap break-words">{r.notes||'No notes entered.'}</p></article>)}
 </section>;
}
