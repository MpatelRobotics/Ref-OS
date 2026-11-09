import {assertEventCodeProgram,eventCodeProgram} from '../../supabase/functions/_shared/competitionProgram.js';
import VexEventFinder from "./VexEventFinder.jsx";
import React, { useRef, useState, useEffect } from 'react';
export default function VexEventLookup({ onLookup, onSearch, onResult, expectedProgram, disabled = false, onBusy = () => {} }) {
  const [code,setCode]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [result,setResult]=useState(null);
  const [finderBusy,setFinderBusy]=useState(false);
  const request = useRef(0);
  useEffect(()=>{if(result&&expectedProgram&&eventCodeProgram(result.code)!==expectedProgram){setResult(null);onResult(null);setError('Use an event code matching the selected competition program.');}},[expectedProgram,result,onResult]);
  const lookup = async (selectedCode = code) => {
    const id=++request.current; setBusy(true);onBusy(true);setError('');setResult(null);onResult(null);
    try { assertEventCodeProgram(selectedCode,expectedProgram);const event=await onLookup(selectedCode,expectedProgram); if(id!==request.current)return;setResult(event);onResult(event); }
    catch(e){if(id===request.current)setError(e.message||'Could not look up the event.');}
    finally{if(id===request.current){setBusy(false);onBusy(false);}}
  };
  return <section className="mb-4 rounded-xl border border-sky-200 dark:border-sky-800 p-3 space-y-2">
    <label htmlFor="vex-event-code" className="block text-sm font-semibold">Autofill from VEX Events (optional)</label>
    <div className="flex gap-2"><input id="vex-event-code" value={code} disabled={busy||disabled||finderBusy} onChange={e=>{setCode(e.target.value);setResult(null);onResult(null);}} placeholder="RE-V5RC-26-4270" className="w-full min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2"/><button type="button" disabled={busy||disabled||finderBusy||!code.trim()} onClick={()=>lookup()} className="shrink-0 rounded-lg bg-blue-700 text-white px-3 py-2 disabled:opacity-50">{busy?'Looking up…':'Look up'}</button></div>
    <p className="text-xs text-slate-500 dark:text-slate-400">Use the VEX event code, not a Ref OS access code. Review the result before creating your event. Match schedules and results still come from Tournament Manager.</p>
    {onSearch&&<VexEventFinder expectedProgram={expectedProgram} onSearch={onSearch} disabled={disabled||busy} onBusy={value=>{setFinderBusy(value);onBusy(value);}} onSelect={value=>{setCode(value);lookup(value);}}/>}
    {error&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{error} You can still create the event manually.</p>}
    {result&&<div role="status" className="text-sm space-y-1"><p className="font-semibold">{result.name}</p><p>{result.code} · {result.program}</p><p>{result.start?.slice(0,10)}{result.end&&result.end.slice(0,10)!==result.start?.slice(0,10)?` – ${result.end.slice(0,10)}`:''}</p><p>{result.location}</p>{result.timezone?<p>Detected timezone: <b>{result.timezone.replaceAll('_',' ')}</b>. You can change it in Event Setup &amp; Settings.</p>:<p>Timezone could not be detected. Choose it in Event Setup &amp; Settings.</p>}<p>{result.teams.length} registered teams will be added when you create this event.</p></div>}
  </section>;
}
