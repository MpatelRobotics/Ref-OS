import React,{useEffect,useRef,useState} from 'react';
import {normalizeTmSnapshot} from '../tmSnapshot.js';
import {matchTmDivision} from '../tmDivisionMapping.js';
import {scopeTmFieldActivity} from '../tmFieldActivity.js';

export default function TmMultiServerSync({open,onClose,onExit,refosDivisions=[],expectedCode='',initialAddress='',initialApiKey='',onDiscoverDivisions,...props}) {
 const [rows,setRows]=useState(()=>[0,1].map(i=>({id:`server-${i+1}`,address:'',apiKey:'',target:String(refosDivisions[i]?.id||''),division:'',session:'',remote:[],sessions:[],reviewed:null,ready:false,status:''})));
 const [address,setAddress]=useState(initialAddress),[apiKey,setApiKey]=useState(initialApiKey);
 const credentialsChanged=()=>{setRows(old=>old.map(row=>({...row,division:'',remote:[],session:'',sessions:[],ready:false,reviewed:null,status:''})));};
 const [running,setRunning]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const latest=useRef(props);latest.current=props;
 const runtime=useRef(new Map()),currentRows=useRef(rows);currentRows.current=rows;
 const active=useRef(true),epoch=useRef(0),working=useRef(false),runningRef=useRef(false);
 const update=(id,value)=>setRows(old=>old.map(r=>r.id===id?{...r,...value}:r));
 const patch=(id,value)=>update(id,{...value,ready:false,reviewed:null,status:''});
 const validEvent=data=>{if(expectedCode&&data.event?.code&&expectedCode.trim().toUpperCase()!==data.event.code.trim().toUpperCase())throw Error('TM is serving a different event code.');};
 const request=row=>({address,apiKey,division:Number(row.division),channelId:row.id,liveFields:true,forceScores:true});
 const disconnect=async()=>{const states=[...runtime.current.values()];runtime.current.clear();for(const state of states)if(state.connectionId)await latest.current.onDisconnect?.(state.connectionId,'').catch(()=>{});};
 const stop=async()=>{epoch.current++;runningRef.current=false;setRunning(false);setBusy(true);const ticket=epoch.current;for(const row of currentRows.current){const state=runtime.current.get(row.id);if(state?.fields)await latest.current.onPublishActivity?.({fieldSets:state.fields.map(set=>({...set,connected:false})),updatedAt:Date.now(),source:'TM WebSocket'},()=>active.current&&ticket===epoch.current,Number(row.target)).catch(()=>{});}await disconnect();if(active.current)setBusy(false);};
 useEffect(()=>{active.current=true;return()=>{active.current=false;epoch.current++;runningRef.current=false;disconnect();};},[]);
 useEffect(()=>{window.refosTmDesktop?.setSyncActive(running).catch(()=>{});return()=>{window.refosTmDesktop?.setSyncActive(false).catch(()=>{});};},[running]);
 const loadDivisions=async()=>{
  if(working.current)return;working.current=true;setBusy(true);setError('');const ticket=epoch.current;
  try{
   const data=await latest.current.onFetch({...request(rows[0]),division:null,liveFields:false});
   if(!active.current||ticket!==epoch.current)return;validEvent(data);
   if(!data.multiServer)throw Error('Update the connector to enable multi-division syncing.');
   if(!Array.isArray(data.divisions)||data.divisions.length<2||data.divisions.some(d=>!Number.isSafeInteger(d.id)||d.id<1||typeof d.name!=='string')||new Set(data.divisions.map(d=>d.id)).size!==data.divisions.length)throw Error('TM must have at least two divisions to sync both.');
   const catalog=refosDivisions.length?refosDivisions:await onDiscoverDivisions?.(data.divisions)||[];
   if(!active.current||ticket!==epoch.current)return;
   setRows(old=>old.map((row,index)=>({...row,target:row.target||String(catalog[index]?.id||''),remote:data.divisions,division:String(matchTmDivision(data.divisions,catalog,Number(row.target||catalog[index]?.id))?.id||''),session:'',sessions:[],ready:false,reviewed:null,status:''})));
  }catch(e){if(active.current&&ticket===epoch.current)setError(e.message||'Could not load TM divisions.');}
  finally{working.current=false;if(active.current)setBusy(false);}
 };
 const review=async row=>{
  if(working.current)return;working.current=true;setBusy(true);setError('');
  const ticket=epoch.current;
  try{
   const header=await latest.current.onFetch({...request(row),division:null,liveFields:false});
   if(!active.current||ticket!==epoch.current)return;validEvent(header);
   if(!header.multiServer)throw Error('Update the connector to enable multi-division syncing.');
   const mapped=matchTmDivision(header.divisions||[],refosDivisions,Number(row.target));
   const division=row.division&&header.divisions?.some(d=>d.id===Number(row.division))?Number(row.division):mapped?.id||(header.divisions?.length===1?header.divisions[0].id:null);
   update(row.id,{remote:header.divisions||[],division:division?String(division):'',ready:false});
   if(!division)throw Error('Choose the TM division, then review again.');
   const data=await latest.current.onFetch({...request(row),division,liveFields:false});
   if(!active.current||ticket!==epoch.current)return;validEvent(data);
   const snapshot=normalizeTmSnapshot(data,row.session===''?undefined:Number(row.session));
   update(row.id,{reviewed:data.event.code||data.event.name,sessions:snapshot.sessions,ready:snapshot.selectedSession!=null||!snapshot.sessions.length,status:`${data.event.name} · ${snapshot.matches.length} matches · ${snapshot.scores.length} scores`});
  }catch(e){if(active.current)update(row.id,{ready:false,status:e.message||'Review failed.'});}
  finally{working.current=false;if(active.current)setBusy(false);}
 };
 const tick=async()=>{
  if(working.current||!runningRef.current||!navigator.onLine||(!window.refosTmDesktop&&document.hidden))return;
  working.current=true;const ticket=epoch.current;
  const current=()=>active.current&&runningRef.current&&ticket===epoch.current;
  try{for(const row of currentRows.current){
   if(!current())return;
   const state=runtime.current.get(row.id)||{hashes:{},due:0,observed:new Map(),refresh:0};runtime.current.set(row.id,state);
   try{
    if(Date.now()>=state.due||(state.refresh&&Date.now()>=state.refresh)){
     const data=await latest.current.onFetch(request(row));if(!current()){if(data.connectionId)await latest.current.onDisconnect?.(data.connectionId,'').catch(()=>{});return;}validEvent(data);
     if(!data.multiServer)throw Error('Update the connector to enable multi-division syncing.');
     if((data.event.code||data.event.name)!==row.reviewed)throw Error('TM event changed. Stop and review the divisions again.');
     const snapshot=normalizeTmSnapshot(data,row.session===''?undefined:Number(row.session));
     if(snapshot.sessions.length&&snapshot.selectedSession==null)throw Error('Choose a TM session.');
     await latest.current.onApply(snapshot,{includeSchedule:true,includeSkills:row.id===currentRows.current[0].id,hashes:state.hashes,current,refosDivisionId:Number(row.target)});
     if(!current())return;state.session=snapshot.selectedSession;state.connectionId=data.connectionId;if(state.refresh&&Date.now()>=state.refresh)state.refresh=0;
     const seconds=snapshot.matches.some(m=>['r16','qf','sf','final'].includes(m.phase))?15:30;
     state.due=Date.now()+seconds*1000;update(row.id,{status:`Synced · every ${seconds}s · ${new Date().toLocaleTimeString()}`});
    }
    if(state.connectionId&&latest.current.onActivity){
     const data=await latest.current.onActivity(state.connectionId,'');if(!current())return;
     const fieldSets=scopeTmFieldActivity(data,Number(row.division),state.session);
     for(const set of fieldSets)for(const field of set.fields){
      const key=`${set.id}:${field.id}`,playing=set.connected&&field.status==='playing'&&field.match?JSON.stringify(field.match):'';
      if(playing&&state.observed.get(key)!==playing)state.refresh=state.refresh?Math.min(state.refresh,Date.now()+30000):Date.now()+30000;
      state.observed.set(key,playing);
     }
     const fingerprint=JSON.stringify(fieldSets);
     if(state.fingerprint!==fingerprint||Date.now()-(state.published||0)>30000){await latest.current.onPublishActivity?.({fieldSets,updatedAt:Date.now(),source:'TM WebSocket'},current,Number(row.target));state.fingerprint=fingerprint;state.published=Date.now();state.fields=fieldSets;}
    }
   }catch(e){if(current()){
    update(row.id,{status:e.message||'Sync failed; retrying.'});state.fingerprint='';state.due=Date.now()+15000;state.refresh=0;const failedConnection=state.connectionId;state.connectionId='';if(failedConnection)await latest.current.onDisconnect?.(failedConnection,'').catch(()=>{});
    if(state.fields)await latest.current.onPublishActivity?.({fieldSets:state.fields.map(s=>({...s,connected:false})),updatedAt:Date.now(),source:'TM WebSocket'},current,Number(row.target)).catch(()=>{});
   }}
  }}finally{working.current=false;}
 };
 const tickRef=useRef(tick);tickRef.current=tick;
 useEffect(()=>{if(!running)return;tickRef.current();const timer=setInterval(()=>tickRef.current(),1000);return()=>clearInterval(timer);},[running]);
 const start=()=>{
  if(rows.some(r=>!r.ready||!refosDivisions.some(d=>Number(d.id)===Number(r.target)))){setError('Review both divisions and select their Ref OS divisions.');return;}
  if(rows[0].target===rows[1].target){setError('Choose a different Ref OS division for each TM division.');return;}
  if(rows[0].division===rows[1].division){setError('Choose two different TM divisions.');return;}
  epoch.current++;runningRef.current=true;setRunning(true);setError('');onClose();
 };
 const input='block w-full min-h-[44px] rounded-lg border bg-white dark:bg-slate-900 px-3 py-2';
 return <>
  {running&&<div role="status" className="mx-4 mb-4 rounded-lg border p-3"><p className="font-semibold">Both TM divisions syncing sequentially</p>{rows.map(r=><p key={r.id}>{refosDivisions.find(d=>String(d.id)===r.target)?.name}: {r.status}</p>)}<button className="min-h-[44px] rounded-lg border px-3" onClick={stop}>Stop both divisions</button></div>}
  {open&&<div className="fixed inset-0 z-[60] bg-black/40 p-3 flex items-center justify-center"><section role="dialog" aria-modal="true" aria-label="Sync both TM divisions" className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-xl bg-white dark:bg-slate-800 p-4 space-y-4">
   <div className="flex justify-between gap-3"><h2 className="font-bold">Sync both TM divisions</h2><button className="min-h-[44px] border rounded-lg px-3" onClick={onClose}>Close</button></div>
   <p>Enter one TM server address and event API key. Map its two TM divisions to your Ref OS divisions. Matches, scores and rankings sync in sequence; Skills syncs once for the whole event. Keys stay in memory. Keep Android open and awake while syncing.</p>
   {!refosDivisions.length&&<p>Configure the event’s Ref OS divisions first.</p>}
   <fieldset disabled={busy||running} className="space-y-3">
    <label>TM server IP address<input className={input} value={address} onChange={e=>{setAddress(e.target.value);credentialsChanged();}} autoCapitalize="none" autoComplete="off"/></label>
    <label>Event API key<input type="password" className={input} value={apiKey} onChange={e=>{setApiKey(e.target.value);credentialsChanged();}} autoComplete="off"/></label>
   </fieldset>
   <button className="min-h-[44px] rounded-lg border px-3" disabled={busy||running||!address||!apiKey} onClick={loadDivisions}>Load TM divisions</button>
   {rows.map((row,index)=><fieldset key={row.id} disabled={busy||running} className="border rounded-xl p-3 space-y-3"><legend className="px-1 font-semibold">Division mapping {index+1}</legend>
    <label>Ref OS division<select className={input} value={row.target} onChange={e=>patch(row.id,{target:e.target.value})}><option value="">Choose division</option>{refosDivisions.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    <label>TM division<select aria-label="TM division" className={input} disabled={!row.remote.length} value={row.division} onChange={e=>patch(row.id,{division:e.target.value,session:''})}><option value="">Choose division</option>{row.remote.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    {row.sessions.length>1&&<label>TM session<select className={input} value={row.session} onChange={e=>patch(row.id,{session:e.target.value})}><option value="">Choose session</option>{row.sessions.map(id=><option key={id} value={id}>Session {id}</option>)}</select></label>}
    <button className="min-h-[44px] rounded-lg border px-3" disabled={!address||!apiKey||!row.target} onClick={()=>review(row)}>Review division {index+1}</button><p role="status">{row.status}</p>
   </fieldset>)}
   {error&&<p role="alert">{error}</p>}
   <button className="min-h-[44px] rounded-lg bg-red-700 text-white px-4 disabled:opacity-50" disabled={busy||running||rows.some(r=>!r.ready)} onClick={start}>Start both divisions</button>
   {!running&&<button className="ml-3 min-h-[44px] rounded-lg border px-3" onClick={onExit}>Sync one division</button>}
  </section></div>}
 </>;
}
