import React,{useEffect,useRef,useState} from 'react';
export default function VexLiveSync({initialCode='',target='',onFetch,onApply,onClose}){
 const [code,setCode]=useState(initialCode),[division,setDivision]=useState(''),[divisions,setDivisions]=useState([]),[kind,setKind]=useState('matches'),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[auto,setAuto]=useState(false),[approved,setApproved]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 const running=useRef(false),last=useRef(''),active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const reset=()=>{setAuto(false);setApproved(false);setPreview(null);last.current='';setStatus('');setError('');};
 const check=async(background=false)=>{
 if(running.current||document.hidden||!navigator.onLine)return;
 running.current=true;setBusy(true);setError('');
 try{const data=await onFetch(code,division||null,kind);if(!active.current)return;setDivisions(data.divisions);
 if(!division){setStatus('Select a division, then check for data.');return;}
 const signature=JSON.stringify(data[kind]||[]);
 if(background){if(data.warnings?.length)throw new Error(data.warnings[0]+' Automatic updates stopped. Review a new preview.');if(signature!==last.current){await onApply(data,kind);last.current=signature;}setStatus('Last checked '+new Date().toLocaleTimeString()+'. API data may lag the event.');}
 else{setPreview(data);setStatus('Review this snapshot before importing.');}
 }catch(e){if(active.current){setError(e.message||'VEX sync failed.');setAuto(false);}}
 finally{running.current=false;if(active.current)setBusy(false);}
 };
 const latestCheck=useRef(check);latestCheck.current=check;
 useEffect(()=>{if(!auto)return;const timer=setInterval(()=>latestCheck.current(true),60000);return()=>clearInterval(timer);},[auto,code,division,kind]);
 const apply=async()=>{setBusy(true);try{await onApply(preview,kind);last.current=JSON.stringify(preview[kind]||[]);setApproved(true);setPreview(null);setStatus('Imported. You can enable automatic checks for this category.');}catch(e){setError(e.message||'Import failed. Retry this snapshot.');setAuto(false);}finally{setBusy(false);}};
 return <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3"><section role="dialog" aria-modal="true" aria-label="VEX API Sync" className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-xl bg-white dark:bg-slate-800 p-4 space-y-3">
 <h2 className="text-xl font-bold">VEX API Sync</h2><p className="text-sm">Target: {target}</p><p className="text-xs text-slate-500">Experimental. VEX publication timing is outside Ref OS's control. Automatic checks run once a minute while this screen is open and visible. Errors stop automatic updates.</p>
 <label className="block text-sm">VEX event code<input value={code} disabled={busy||auto} onChange={e=>{setCode(e.target.value.toUpperCase());setDivision('');setDivisions([]);reset();}} className="w-full border rounded-lg bg-transparent p-2"/></label>
 <button disabled={busy||auto||!code} onClick={()=>check()} className="border rounded-lg px-3 py-2">{division?'Check for updates':'Load divisions'}</button>
 {divisions.length>0&&<label className="block text-sm">Division<select value={division} disabled={busy||auto} onChange={e=>{setDivision(e.target.value);reset();}} className="w-full rounded-lg border bg-white dark:bg-slate-800 p-2"><option value="">Select division</option>{divisions.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
 <label className="block text-sm">Data to sync<select value={kind} disabled={busy||auto} onChange={e=>{setKind(e.target.value);reset();}} className="w-full rounded-lg border bg-white dark:bg-slate-800 p-2"><option value="matches">Matches and scores</option><option value="rankings">Qualification rankings</option><option value="skills">Skills scores (whole event)</option></select></label>
 {preview&&<div className="border rounded-lg p-3 space-y-2"><p className="font-semibold">{(preview[kind]||[]).length} rows ready</p>{preview.warnings?.length > 0 && <div role="alert" className="text-sm text-amber-700"><p>{preview.warnings.length} unsupported matches skipped. Supported matches can still be imported.</p>{preview.warnings.slice(0,3).map((warning,i)=><p key={i}>{warning}</p>)}</div>}{(preview[kind]||[]).length === 0 && <p className="text-sm">{preview.upstreamRows ? "The API returned data, but none of these rows fit the supported match format. Use Tournament Manager import." : "The API returned no rows for this category and division. Existing data will be kept."}</p>}<p className="text-xs">Importing replaces overlapping schedules, scores, or standings in this target. Empty snapshots keep existing data. Skills totals are shown without official combined ranks because the API reports separate run types.</p><ul className="text-xs space-y-1">{(preview[kind]||[]).slice(0,10).map((row,i)=><li key={i}>{kind==='matches'?`${row.label||row.phase+' '+row.num}: ${row.red.join(' ')} vs ${row.blue.join(' ')} — ${row.scored?row.redScore+' : '+row.blueScore:'unscored'}`:kind==='rankings'?`${row.number}: rank ${row.rank}`:`${row.number}: driver ${row.driver??'—'}, programming ${row.programming??'—'}, total ${row.total}`}</li>)}</ul><button disabled={busy} onClick={apply} className="bg-blue-700 text-white px-3 py-2 rounded-lg">Apply snapshot</button></div>}
 <label className="flex gap-2 text-sm"><input type="checkbox" checked={auto} disabled={!approved||busy} onChange={e=>setAuto(e.target.checked)}/> Automatically update this category every minute</label>
 {status&&<p role="status" className="text-sm">{status}</p>}{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
 <button disabled={busy} onClick={onClose} className="border rounded-lg px-3 py-2">Close and stop syncing</button>
 </section></div>;
}


