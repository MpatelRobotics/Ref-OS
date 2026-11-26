import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '../supabaseClient';
import {saveOperation} from '../eventOperations';

// Team reference notes are shared across divisions, with separate records for league sessions.
export default function RobotReferenceOptions({eventId,sessionId=null,team,canEdit=false,meName='',onSaved}) {
 const [row,setRow]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [pending,setPending]=useState(null);
 const saving=useRef(false),epoch=useRef(0);
 const load=async()=>{
  if(saving.current)return;
  const ticket=++epoch.current;
  try {
   let query=supabase.from('event_operations').select('*').eq('event_id',eventId).eq('kind','robot-change').contains('payload',{recordType:'robot-reference',team}).eq('division_id',0);
   query=sessionId?query.eq('session_id',sessionId):query.is('session_id',null);
   const {data,error}=await query.maybeSingle();if(error)throw error;
   if(ticket===epoch.current){setRow(data);setError('');}
  }catch(e){if(ticket===epoch.current)setError('Could not load robot configuration notes. Reconnect and refresh.');}
  finally{if(ticket===epoch.current)setLoading(false);}
 };
 useEffect(()=>{setLoading(true);setRow(null);load();const timer=setInterval(load,15000);return()=>{epoch.current++;clearInterval(timer);};},[eventId,sessionId,team]);
 const toggle=async(key,value)=>{
  if(loading||saving.current||!canEdit)return;
  saving.current=true;epoch.current++;setBusy(true);setError('');setNotice('');
  try {
   const payload={...row?.payload,recordType:'robot-reference',team,status:'open',note:'Robot starting position and configuration reference',owner:meName,zipTieWall:Boolean(row?.payload?.zipTieWall),multiConfiguration:Boolean(row?.payload?.multiConfiguration),[key]:value};
   setPending(payload);
   const saved=await saveOperation(eventId,sessionId,0,'robot-change',payload,row);
   setRow(saved);onSaved?.(saved);setNotice('Saved.');
  }catch(e){setError(e.message || 'Could not save. Reconnect and refresh before trying again.');}
  finally{saving.current=false;setBusy(false);setPending(null);}
 };
 return <section aria-label="Robot starting position and configurations" className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
  <h3 className="font-bold">Starting position &amp; configurations</h3>
  {[['zipTieWall','Starts with zip tie touching wall'],['multiConfiguration','Multiple configurations or add-ons']].map(([key,label])=><label key={key} className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4 text-sm font-semibold">
   <span>{label}</span><input type="checkbox" role="switch" aria-label={label} checked={Boolean((pending || row?.payload)?.[key])} disabled={loading||busy||!canEdit||Boolean(error)} onChange={e=>toggle(key,e.target.checked)} className="h-6 w-6 shrink-0 accent-blue-700 disabled:opacity-50"/>
  </label>)}
  <p className="text-xs text-slate-500 dark:text-slate-400">Pictures are optional. Use the Zip tie / wall start and Configurations / add-ons photo slots below to document these details.</p>
  {loading&&<p role="status" className="text-sm">Loading configuration notes…</p>}{busy&&<p role="status" className="text-sm">Saving…</p>}{notice&&<p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
  {error&&<div role="alert" className="space-y-2 text-sm text-red-700 dark:text-red-300"><p>{error}</p><button type="button" disabled={busy} onClick={()=>{setLoading(true);load();}} className="min-h-[44px] rounded border px-3">Refresh configuration notes</button></div>}
 </section>;
}
