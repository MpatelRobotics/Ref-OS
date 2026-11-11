import React,{useEffect,useState} from 'react';
import {createJudgeGroupCode,listJudgeGroupCodes,disableJudgeGroupCode,deleteJudgeGroups} from '../judgeGroupApi';
export default function JudgeGroupCodes({eventId,entries,groups=[],inline=false,onChanged,onDeleted,quickSetup=false}){
 const [rows,setRows]=useState([]),[codes,setCodes]=useState({}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [newName,setNewName]=useState(''),[selected,setSelected]=useState([]);
 const [copied,setCopied]=useState('');
 const [loading,setLoading]=useState(true);
 const reload=async()=>{
  try {setRows(await listJudgeGroupCodes(eventId));}
  catch(e){setError(e.message);}
  finally{setLoading(false);}
 };
 useEffect(()=>{void reload();},[eventId]);
 const names=[...new Set(rows.map(r=>r.name))].sort();
 const canAdd=!loading&&!busy&&Boolean(newName.trim())&&!names.some(name=>name.toLowerCase()===newName.trim().toLowerCase());
 const run=async(name,disable=false)=>{if(!disable&&rows.some(r=>r.name===name)&&!confirm('Replace this group code? Existing group logins will be revoked.'))return;setBusy(true);setCopied('');try{if(disable){await disableJudgeGroupCode(eventId,name);setCodes(old=>({...old,[name]:null}));}else setCodes(old=>({...old,[name]:null}));if(!disable){const code=await createJudgeGroupCode(eventId,name);setCodes(old=>({...old,[name]:code}));if(quickSetup)setNewName('');}setError('');await reload();onChanged?.();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const remove=async(names)=>{if(!names.length||!confirm(`Delete ${names.length} judge groups and their logins across this event? Their interviews, interview notes, assignments, conflicts and progress will be removed, and signed-in judges will lose access. Unsaved interview changes will be discarded.`))return;setBusy(true);try{await deleteJudgeGroups(eventId,names);setCodes({});setSelected([]);await reload();onChanged?.();await onDeleted?.();setError('');}catch(e){setError(e.message);}finally{setBusy(false);}};
 const Container=inline?'section':'details',Title=inline?'h3':'summary';
 if(quickSetup)return <section className="mb-5 space-y-4 rounded-xl border bg-white p-4 dark:bg-slate-800">
  <form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();if(canAdd)void run(newName.trim());}}>
   <label className="min-w-0 flex-1">Group name or judges’ names
    <input maxLength={100} required value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Group A" className="mt-1 block min-h-[44px] w-full rounded border bg-transparent p-2"/>
   </label>
   <button disabled={!canAdd} className="min-h-[44px] rounded bg-indigo-700 px-4 font-semibold text-white disabled:opacity-50">Add group</button>
  </form>
  {error&&<p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
  {loading&&<p role="status">Loading groups…</p>}
  {!loading&&!names.length&&<p>Add your first group to start planning interviews.</p>}
  {rows.map(row=>{
   return <article key={row.name} className="space-y-2 rounded border p-3">
    <h3 className="font-semibold">{row.name}</h3>
    {!row.enabled&&<p>Sign-in disabled</p>}
    {codes[row.name]&&<p>Event group login code <code className="select-all font-mono font-bold">{codes[row.name]}</code></p>}
    <details>
     <summary className="min-h-[44px] cursor-pointer py-2">Group settings</summary>
     <div className="flex flex-wrap gap-2">
      <button disabled={busy} onClick={()=>run(row.name)} className="min-h-[44px] rounded border px-3">Create / replace group code</button>
      {row.enabled&&<button disabled={busy} onClick={()=>{if(confirm('Disable access for '+row.name+'?'))void run(row.name,true);}} className="min-h-[44px] rounded border px-3">Disable group login</button>}
      <button disabled={busy} onClick={()=>remove([row.name])} className="min-h-[44px] rounded border px-3 text-red-700 dark:text-red-300">Delete group</button>
     </div>
    </details>
   </article>;
  })}
  {names.length>0&&<details>
   <summary className="min-h-[44px] cursor-pointer py-2">Manage all groups</summary>
   <button onClick={reload} disabled={busy} className="min-h-[44px] rounded border px-3">Refresh groups</button>
   <button disabled={busy} onClick={()=>remove(names)} className="min-h-[44px] rounded border px-3 text-red-700 dark:text-red-300">Delete all groups &amp; logins</button>
  </details>}
 </section>;
 return <Container className="mb-5 rounded-xl border bg-white p-4 dark:bg-slate-800"><Title className="min-h-[44px] font-bold cursor-pointer">Judge-group logins</Title><p className="my-3 text-sm">Create group logins before generating interviews so judges can declare their conflicts. Name each group with its judges’ names. New codes use number–letter–number–letter–number (for example 3A7B2). Give each group its own code; they use Judge-group login on the event sign-in page. Codes are shown only when created. Group logins last 12 hours; replacing or disabling a code revokes them.</p>{error&&<p role="alert" className="text-red-700">{error}</p>}<div className="my-3 space-y-2"><label>Judges’ names for new group<input maxLength={100} placeholder="John, Sarah, Michael" value={newName} onChange={e=>setNewName(e.target.value)} className="block min-h-[44px] w-full rounded border bg-transparent p-2"/></label><button disabled={busy||!newName.trim()||names.some(n=>n.toLowerCase()===newName.trim().toLowerCase())} className="min-h-[44px] rounded border px-3" onClick={()=>run(newName.trim())}>Create group login before assigning teams</button></div><div className="flex flex-wrap gap-2"><button disabled={busy||!selected.length} className="min-h-[44px] rounded border px-3 text-red-700" onClick={()=>remove(selected)}>Delete selected groups & logins</button><button disabled={busy||!names.length} className="min-h-[44px] rounded border px-3 text-red-700" onClick={()=>remove(names)}>Delete all groups & logins</button></div>{!names.length&&<p>No named judge groups yet.</p>}{names.map(name=><div key={name} className="my-3 rounded border p-3"><label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" aria-label={`Select group ${name}`} checked={selected.includes(name)} disabled={busy} onChange={e=>setSelected(old=>e.target.checked?[...old,name]:old.filter(n=>n!==name))}/><b>{name}</b></label><p>{rows.find(r=>r.name===name)?.enabled?'Enabled':'Not enabled'}</p>{codes[name]&&<div className="my-2 flex flex-wrap items-center gap-3"><p>Group login code: <code className="font-mono break-all select-all">{codes[name]}</code></p><button type="button" disabled={busy} aria-label={`Copy code for ${name}`} className="min-h-[44px] rounded border px-3" onClick={async()=>{try{await navigator.clipboard.writeText(codes[name]);setCopied(name);setError('');}catch{setError('Could not copy automatically. Select just the code and copy it.');}}}>Copy code</button>{copied===name&&<span role="status">Code copied</span>}</div>}<div className="flex flex-wrap gap-2"><button disabled={busy} className="min-h-[44px] rounded border px-3" onClick={()=>run(name)}>Create / replace code</button><button disabled={busy||!rows.find(r=>r.name===name)?.enabled} className="min-h-[44px] rounded border px-3" onClick={()=>{if(confirm(`Disable access for ${name}?`))run(name,true);}}>Disable group login</button></div></div>)}</Container>;
}
