import React,{useState} from 'react';
const fold=value=>String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export default function FilteredSelect({label,searchLabel,options,value,onChange,disabled=false,placeholder='Select an option',className=''}) {
 const [query,setQuery]=useState('');
 const visible=options.filter(o=>o.value===value||fold(`${o.label} ${o.value} ${o.keywords||''}`).includes(fold(query.trim())));
 const input=`min-h-[44px] w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 ${className}`;
 return <div className="min-w-0 space-y-1"><label className="block text-sm">{searchLabel}<input aria-label={searchLabel} type="search" className={input} value={query} disabled={disabled} onChange={e=>setQuery(e.target.value)} placeholder={searchLabel}/></label><label className="block text-sm">{label}<select aria-label={label} className={input} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="">{placeholder}</option>{visible.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>{!visible.length&&<p role="status" className="text-sm text-slate-500">No matching options.</p>}</div>;
}
