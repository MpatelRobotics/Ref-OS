import React,{useState} from 'react';
export function practiceRows(form,by='Demo Ref') {
 const groups=form.ruleGroups?.length?form.ruleGroups:[{type:form.type,code:form.code,desc:form.desc}];
 return groups.map(group=>({id:crypto.randomUUID(),team:String(form.team||form.newNumber||'').trim().toUpperCase(),type:group.type||'minor',code:String(group.code||'').replace(/[<>]/g,''),desc:String(group.desc||''),notes:form.notes||'',match:form.match?.phase&&form.match.phase!=='none'?form.match:null,by,createdAt:Date.now(),photoKeys:[],_localPhotos:form.photos||[],practice:true}));
}
// Intentionally has no API, outbox, storage or persistence imports. These entries exist only here.
export default function HighlanderPractice({renderForm,renderEntry,by}) {
 const [open,setOpen]=useState(false),[entries,setEntries]=useState([]);
 const save=async form=>{setEntries(previous=>[...practiceRows(form,by),...previous]);setOpen(false);};
 return <section aria-label="Practice violations" className="mb-4 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 p-4 space-y-3"><h2 className="font-bold">Practice violations · Highlander demo</h2><p className="text-sm">Try the violation form without saving to the event. These entries are temporary on this device, are excluded from event totals and exports, and disappear when you leave or reload.</p><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setOpen(true)} className="min-h-[44px] bg-indigo-700 text-white rounded-lg px-4 py-2 font-semibold">Log practice violation</button>{entries.length>0&&<button type="button" onClick={()=>setEntries([])} className="min-h-[44px] border border-indigo-300 rounded-lg px-3 py-2">Clear practice entries</button>}</div>{entries.length>0&&<><p role="status" className="text-sm font-semibold">{entries.length} temporary practice {entries.length===1?'entry':'entries'} · Not saved</p><ul className="space-y-2">{entries.map(entry=>renderEntry(entry,()=>setEntries(previous=>previous.filter(row=>row.id!==entry.id))))}</ul></>}{open&&renderForm({onSave:save,onClose:()=>setOpen(false)})}</section>;
}
