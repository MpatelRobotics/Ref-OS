import React, {useState} from 'react';

const input = 'mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2';
export default function DivisionSetup({rows, onChange, activeId, disabled}) {
  const [selected,setSelected] = useState(rows.some(row=>row.id===activeId)?activeId:rows[0].id);
  const current = rows.find(row=>row.id===selected) || rows[0];
  const update = changes => onChange(rows.map(row=>row.id===current.id?{...row,...changes}:row));
  const add = () => {
    const id = Math.max(0,...rows.map(row=>Number(row.id)))+1;
    onChange([...rows,{id,name:`Division ${rows.length+1}`,customName:true,fieldCount:3,fieldNames:{'Field 1':'Field 1','Field 2':'Field 2','Field 3':'Field 3'}}]);
    setSelected(id);
  };
  return <fieldset disabled={disabled} className="space-y-4">
    <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Divisions &amp; fields</legend>
    <p className="text-sm text-slate-600 dark:text-slate-300">Select a division to edit its name and field names. Changes are saved with Save Settings.</p>
    <label className="block text-sm font-semibold">Division to configure<select className={input} value={current.id} onChange={e=>setSelected(Number(e.target.value))}>{rows.map(row=><option key={row.id} value={row.id}>{row.name || 'Unnamed division'}</option>)}</select></label>
    <button type="button" onClick={add} className="min-h-[44px] rounded-lg border px-4 py-2 font-semibold">Add division</button>
    <label className="block text-sm font-semibold">Division name<input className={input} maxLength={500} value={current.name} onChange={e=>update({name:e.target.value,customName:true})}/></label>
    <label className="block text-sm font-semibold">Number of competition fields<select className={input} value={current.fieldCount} onChange={e=>update({fieldCount:Number(e.target.value)})}>{[1,2,3].map(n=><option key={n} value={n}>{n} {n===1?'field':'fields'}</option>)}</select></label>
    {Array.from({length:current.fieldCount},(_,i)=>`Field ${i+1}`).map(key=><label key={key} className="block text-sm font-semibold">{key} name<input className={input} maxLength={80} value={current.fieldNames[key] || ''} onChange={e=>update({fieldNames:{...current.fieldNames,[key]:e.target.value}})}/></label>)}
    <p className="text-xs text-slate-500 dark:text-slate-400">Division IDs and saved match assignments stay the same. VEX or TM sync overrides custom division names. Synced schedules determine field names and counts when available; custom field names are used before a schedule is available.</p>
  </fieldset>;
}
