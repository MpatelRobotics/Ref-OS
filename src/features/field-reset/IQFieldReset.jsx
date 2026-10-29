
import React,{useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronLeft,CheckCircle2,RotateCcw} from 'lucide-react';
const AREAS=[
 {id:1,name:'Top left',position:{left:'8%',top:0,width:'42%',height:'50%'}},
 {id:2,name:'Top right',position:{left:'50%',top:0,width:'48%',height:'50%'}},
 {id:3,name:'Bottom left',position:{left:'1%',top:'50%',width:'49%',height:'50%'}},
 {id:4,name:'Bottom right',position:{left:'50%',top:'50%',width:'48%',height:'50%'}},
];
export default function IQFieldReset({checks=[],matchLabel='',meName='Ref',onVerify,onReset,onClose,canVerify=true}){
 const [active,setActive]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState(''),[expanded,setExpanded]=useState(false);
 const saved=new Map(checks.map(row=>[Number(row.quadrant),row]));
 const count=AREAS.filter(area=>saved.has(area.id)).length,area=AREAS.find(row=>row.id===active),stamp=saved.get(active);
 const run=async action=>{if(busy)return;setBusy(true);setError('');try{await action();}catch(e){setError(e.message||'Could not save the field check. Reconnect and try again.');}finally{setBusy(false);}};
 const verify=()=>run(async()=>{await onVerify(active);const next=AREAS.find(row=>row.id!==active&&!saved.has(row.id));if(next)setActive(next.id);});
 const reset=()=>{if(confirm('Clear all four field-reset checks for '+matchLabel+'? Verifier names and times will be removed.'))run(()=>onReset());};
 return createPortal(<div role="dialog" aria-modal="true" aria-labelledby="iq-field-reset-title" className="fixed inset-0 z-[70] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col">
  <header className="flex items-center gap-3 border-b border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 px-4 py-3" style={{paddingTop:'max(.75rem,env(safe-area-inset-top))'}}>
   <button onClick={onClose} className="min-h-[44px] flex items-center gap-1 font-semibold"><ChevronLeft size={20}/>Back</button>
   <h2 id="iq-field-reset-title" className="font-bold flex-1 text-blue-800 dark:text-blue-200">IQ Field Reset · {matchLabel}</h2>
   {canVerify&&<button disabled={busy||!count} onClick={reset} className="min-h-[44px] rounded-lg border border-blue-200 dark:border-blue-800 px-3 disabled:opacity-40 flex items-center gap-1"><RotateCcw size={16}/>Reset</button>}
  </header>
  <main className="flex-1 min-h-0 overflow-y-auto p-4" style={{paddingBottom:'max(1rem,env(safe-area-inset-bottom))'}}><div className="mx-auto max-w-4xl space-y-4">
   <section className={'rounded-xl border p-3 '+(count===4?'border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200':'border-blue-200 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-200')}><h3 className="font-bold">{count===4?'FIELD READY':'FIELD NOT READY'}</h3><p className="text-sm">{count}/4 areas verified · saved for this match and shared across event devices</p></section>
   <p className="text-sm text-slate-600 dark:text-slate-300">Use the orientation shown below. Compare all field objects and nearby supply bags with the reference, then confirm each area.</p>
   <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{AREAS.map(item=><button key={item.id} onClick={()=>setActive(item.id)} aria-pressed={active===item.id} disabled={busy} className={'min-h-[44px] border rounded-lg px-3 py-2 text-sm font-semibold '+(active===item.id?'border-blue-600 bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100':'border-slate-300 dark:border-slate-700')}><span>{item.name}</span>{saved.has(item.id)&&<CheckCircle2 aria-label="Verified" className="inline ml-1 text-emerald-600" size={16}/>}</button>)}</div>
   <button type="button" onClick={()=>setExpanded(true)} aria-label="Enlarge IQ field reference" className="relative block w-full rounded-xl overflow-hidden border border-blue-200 bg-white">
    <img src="/field-setup/iq-level-up.webp" alt="IQ Level Up field reset reference including goals, beams, on-field bags and supply bags" className="block w-full h-auto"/>
    <div aria-hidden="true" className="absolute border-4 border-blue-600 bg-blue-500/10 pointer-events-none" style={area.position}/>
   </button>
   <p className="text-xs text-slate-500">Tap the diagram to enlarge it.</p>
   <section className="rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 p-4 space-y-3">
    <h3 className="font-bold text-blue-800 dark:text-blue-200">{area.name} area</h3>
    {stamp?<p className="text-sm text-emerald-700 dark:text-emerald-300">Verified by {stamp.verifiedBy||'Ref'}{stamp.verifiedAt?' · '+new Date(stamp.verifiedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):''}</p>:<p className="text-sm">Confirm that all positions in the highlighted area match the field reference.</p>}
    {canVerify&&<button disabled={busy||!!stamp} onClick={verify} className="min-h-[44px] w-full rounded-lg bg-blue-700 text-white px-4 py-3 font-semibold disabled:opacity-50">{busy?'Saving…':stamp?'Area verified':'Verify '+area.name.toLowerCase()+' area'}</button>}
    {canVerify&&!stamp&&<p className="text-xs text-slate-500">Saving as {meName}</p>}
   </section>
   {error&&<p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
  </div></main>
  {expanded&&<div role="dialog" aria-modal="true" aria-label="IQ field reference" className="fixed inset-0 z-[90] bg-white text-slate-900 flex flex-col">
    <div className="flex items-center justify-between p-3 border-b"><p className="text-sm">Full field reference · scroll to inspect all positions</p><button onClick={()=>setExpanded(false)} className="min-h-[44px] rounded-lg border px-3 font-semibold">Close reference</button></div>
    <div className="flex-1 overflow-auto p-2"><img src="/field-setup/iq-level-up.webp" alt="Enlarged IQ Level Up field reset reference" className="w-[998px] max-w-none h-auto"/></div>
  </div>}
 </div>,document.body);
}
