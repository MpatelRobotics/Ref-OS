import React, {useState} from 'react';
import {timingMetrics} from '../tmTiming.js';
import {tmPairingNumber,tmGameNumber} from '../tmMatchIdentity.js';
const duration = ms => ms == null ? '—' : `${Math.floor(ms/60000)}m ${Math.floor(ms%60000/1000)}s`;
const label = row => row.phase === 'qual' ? `Q${row.num}` : row.phase === 'practice' ? `P${row.num}` : ['r16','qf','sf'].includes(row.phase) ? `${row.phase.toUpperCase()}-${tmPairingNumber(row.phase,row.num)} · Game ${tmGameNumber(row.phase,row.num)}` : `Final ${row.num}`;
export default function TmTimingReport({activity,times=[],matches={},zone='UTC'}) {
  const [field,setField] = useState('all');
  const rows = timingMetrics(activity?.timing || [],times,Object.values(matches));
  const fields = [...new Map(rows.map(r=>[r.fieldKey,r.field])).entries()];
  const filtered = rows.filter(r=>field==='all'||r.fieldKey===field).sort((a,b)=>b.startedAt-a.startedAt);
  const latest = filtered.find(r=>r.delayMs!=null);
  const clock = ms => {if(!ms)return '—';try{return new Date(ms).toLocaleString('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit',second:'2-digit',month:'short',day:'numeric'});}catch{return new Date(ms).toLocaleString();}};
  return <section className="space-y-4">
    <p className="text-sm text-slate-600 dark:text-slate-300">Captured while a TM connector or Chrome extension receives live field signals. Times are observed by the connecting device; starts before it connected cannot be recovered. Stops can include aborted runs.</p>
    {!activity?.updatedAt || Date.now()-activity.updatedAt>90000 || !activity.fieldSets?.some(s=>s.connected) ? <p role="status" className="text-sm text-amber-700 dark:text-amber-300">TM live connection unavailable. Showing saved observations only.</p> : <p className="text-sm">TM live activity received {clock(activity.updatedAt)}.</p>}
    <label className="block text-sm">Field<select value={field} onChange={e=>setField(e.target.value)} className="ml-2 min-h-[44px] border rounded-lg bg-white dark:bg-slate-900 px-3"><option value="all">All fields</option>{fields.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
    <div className="rounded-lg border p-3"><h3 className="font-bold">Schedule delay estimate</h3><p>{latest ? `${label(latest)} started ${duration(Math.abs(latest.delayMs))} ${latest.delayMs>0?'late':latest.delayMs<0?'early':'from its scheduled time'}.` : 'Waiting for an observed start with a matching TM scheduled time.'}</p><p className="mt-1 text-xs text-slate-500">Based on the latest matched start in this view, not a guarantee for upcoming matches.</p></div>
    <p className="text-sm">Setup: assignment → start. Play: start → stop. Scoring estimate: stop → result first observed. Turnover estimate: result observed → next start on that field. Cycle: start → next start. Scoring and turnover may overlap real field work; missing signals stay blank. Repeated starts appear as separate runs.</p>
    {!filtered.length ? <p>No match timing captured yet. Start live TM syncing, then run a match.</p> : <div className="space-y-3">{filtered.map(row=><article key={row.key} className="border rounded-lg p-3"><h3 className="font-bold">{label(row)} · {row.field}</h3><dl className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">{[['Actual start (observed)',clock(row.startedAt)],['Actual finish (observed stop)',clock(row.stoppedAt)],['Start delay',row.delayMs==null?'—':`${duration(Math.abs(row.delayMs))} ${row.delayMs<0?'early':'late'}`],['Setup',duration(row.setupMs)],['Play',duration(row.playMs)],['Scoring estimate',duration(row.scoringMs)],['Turnover estimate',duration(row.turnoverMs)],['Full cycle',duration(row.cycleMs)]].map(([name,value])=><div key={name}><dt className="text-slate-500 dark:text-slate-400">{name}</dt><dd className="font-medium">{value}</dd></div>)}</dl></article>)}</div>}
  </section>;
}
