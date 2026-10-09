import React,{useCallback,useRef,useState,useEffect} from 'react';
import VexLiveSync from './VexLiveSync';
export default function VexSyncManager({visible,onOpen,onClose,onFetch,showLaunch=true,setupOpen=false,onSetupClose=()=>{},showStatus=true,...props}){
 const [open,setOpen]=useState(false),[code,setCode]=useState(props.initialCode||''),[division,setDivision]=useState(props.initialDivision ? String(props.initialDivision) : ''),[divisions,setDivisions]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const workers=useRef({}),active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>{if(props.initialCode&&!code)setCode(props.initialCode);},[props.initialCode,code]);
 useEffect(()=>{if(setupOpen)setOpen(true);},[setupOpen]);
 const closeSetup=()=>{setOpen(false);onSetupClose();};
 const tail=useRef(Promise.resolve());
 const latest=useRef(onFetch);latest.current=onFetch;
 const fetchQueued=useCallback((...args)=>{
  const task=tail.current.then(()=>latest.current(...args));
  tail.current=task.catch(()=>{});
  return task;
 },[]);
 const load=async()=>{
  setBusy(true);setError('');
  try{const data=await fetchQueued(code.trim().toUpperCase(),null,'rankings');if(!active.current)return;setDivisions(data.divisions||[]);setDivision(data.divisions?.length===1?String(data.divisions[0].id):'');if(!data.divisions?.length)setError('No divisions found for this event.');}
  catch(e){if(active.current)setError(e.message||'Could not load divisions.');}
  finally{if(active.current)setBusy(false);}
 };
 const start=async(selectedCode=code,selectedDivision=division)=>{
  setBusy(true);setError('');const failures=[];
  try{
   const selected=selectedCode.trim().toUpperCase();await props.onSaveCode?.(selected,Number(selectedDivision));
   for(const category of ['rankings','skills','scores']){
    if(!active.current)return;
    try{await workers.current[category].start(selected,Number(selectedDivision));}catch(e){failures.push(category+': '+(e.message||'Sync failed.'));}
   }
   if(active.current){if(failures.length)setError(failures.join(' '));else closeSetup();}
  }catch(e){if(active.current)setError(e.message||'Could not save event code.');}
  finally{if(active.current)setBusy(false);}
 };
 const autoStarted=useRef(false);
 useEffect(()=>{
  if(!props.autoStart || autoStarted.current || !props.initialCode) return;
  autoStarted.current=true;
  let cancelled=false, launching=false;
  (async()=>{
   try {
    const selected=props.initialCode.trim().toUpperCase();
    const data=await fetchQueued(selected,null,'rankings');
    if(cancelled || !active.current)return;
    const choices=data.divisions||[];
    setCode(selected);setDivisions(choices);
    const chosen=choices.find(d=>d.id===Number(props.initialDivision)) || (choices.length===1?choices[0]:null);
    if(!chosen){setError('Choose a division in Sync everything to start automatic updates.');return;}
    setDivision(String(chosen.id));
    launching=true;
    await start(selected,String(chosen.id));
   }catch(e){if(!cancelled && active.current)setError(e.message||'Automatic sync could not start.');}
  })();
  return()=>{cancelled=true;if(!launching)autoStarted.current=false;};
 },[props.autoStart,props.initialCode,props.initialDivision]);
 return <div aria-label="Independent VEX syncs" className="px-4 pb-[calc(104px+env(safe-area-inset-bottom))] sm:pb-4">
  {showLaunch&&<button type="button" onClick={()=>{setOpen(true);setError('');}} className="my-3 min-h-[44px] rounded-lg bg-red-700 text-white px-4 py-2 font-semibold">Sync everything</button>}
  {open&&<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3"><section role="dialog" aria-modal="true" aria-label="Sync everything" className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-xl bg-white dark:bg-slate-800 p-4 space-y-3">
   <h2 className="text-xl font-bold">Sync everything</h2><p className="text-sm">{props.target}</p>
   <p className="text-sm">Import qualification rankings, Skills, and scores for existing matches, then check all three every 15 seconds while the app is open, visible and online. This is experimental; VEX publication may lag the event. No matches are added.</p>
   <label className="block">VEX event code<input disabled={busy} value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setDivision('');setDivisions([]);setError('');}} className="w-full border rounded-lg bg-transparent p-2"/></label>
   <button type="button" disabled={busy||!code.trim()} onClick={load} className="min-h-[44px] border rounded-lg px-3 py-2">Load divisions</button>
   {!!divisions.length&&<label className="block">Division for rankings and match scores<select disabled={busy} value={division} onChange={e=>setDivision(e.target.value)} className="w-full border rounded-lg bg-white dark:bg-slate-800 p-2"><option value="">Select division</option>{divisions.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
   <p className="text-sm">Skills sync covers the whole event. Each category can be managed or stopped separately after starting.</p>
   {error&&<p role="alert" className="text-red-600">{error} Other categories that started successfully keep running.</p>}
   <button type="button" disabled={busy||!division} onClick={()=>start()} className="min-h-[44px] rounded-lg bg-red-700 text-white px-4 py-2">{busy?'Working…':'Start all syncs'}</button>
   <button type="button" disabled={busy} onClick={closeSetup} className="ml-2 min-h-[44px] border rounded-lg px-3 py-2">Close</button>
  </section></div>}
  <div className="grid gap-2 md:grid-cols-3">{['rankings','skills','scores'].map(category=><VexLiveSync ref={worker=>{workers.current[category]=worker;}} key={category} category={category} showStatus={showStatus} {...props} visible={visible[category]} onFetch={fetchQueued} onOpen={()=>onOpen(category)} onClose={()=>onClose(category)}/>)}</div>
 </div>;
}
