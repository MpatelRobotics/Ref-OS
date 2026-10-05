import React,{useState} from 'react';
const STATES='Alabama,Alaska,Arizona,Arkansas,California,Colorado,Connecticut,Delaware,District of Columbia,Florida,Georgia,Hawaii,Idaho,Illinois,Indiana,Iowa,Kansas,Kentucky,Louisiana,Maine,Maryland,Massachusetts,Michigan,Minnesota,Mississippi,Missouri,Montana,Nebraska,Nevada,New Hampshire,New Jersey,New Mexico,New York,North Carolina,North Dakota,Ohio,Oklahoma,Oregon,Pennsylvania,Rhode Island,South Carolina,South Dakota,Tennessee,Texas,Utah,Vermont,Virginia,Washington,West Virginia,Wisconsin,Wyoming,Puerto Rico,Guam,US Virgin Islands'.split(',');
const dateString=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export default function VexEventFinder({onSearch,onSelect,onBusy=()=>{},disabled=false}) {
 const country='US';
 const [state,setState]=useState(''),[start,setStart]=useState(()=>dateString(new Date())),[end,setEnd]=useState(()=>dateString(new Date(Date.now()+90*86400000)));
 const [events,setEvents]=useState([]),[nextPage,setNextPage]=useState(null),[searched,setSearched]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState('');
 const reset=()=>{setEvents([]);setNextPage(null);setSearched(false);setSelected('');setError('');};
 const search=async(more=false)=>{setBusy(true);onBusy(true);setError('');try{const result=await onSearch({country,state,start,end,page:more?nextPage:1});setEvents(old=>[...new Map((more?[...old,...result.events]:result.events).map(e=>[e.code,e])).values()].sort((a,b)=>a.start.localeCompare(b.start)||a.name.localeCompare(b.name)));setNextPage(result.nextPage);setSearched(true);if(!more)setSelected('');}catch(e){setError(e.message||'Could not search events.');}finally{setBusy(false);onBusy(false);}};
 const locked=busy||disabled;const input='w-full min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-2';
 return <div className="border-t border-sky-200 dark:border-sky-800 pt-3 space-y-2">
 <h3 className="text-sm font-semibold">Or find an event by location</h3>
 <p className="text-xs text-slate-500">United States events · select a date range of up to one year.</p>
 {country==='US'&&<label className="block text-sm">State or territory<select value={state} disabled={locked} onChange={e=>{setState(e.target.value);reset();}} className={input}><option value="">Select state</option>{STATES.map(s=><option key={s}>{s}</option>)}</select></label>}
 <div className="grid grid-cols-2 gap-2"><label className="block min-w-0 text-sm">From date<input type="date" value={start} disabled={locked} onChange={e=>{setStart(e.target.value);reset();}} className={input}/></label><label className="block min-w-0 text-sm">To date<input type="date" value={end} disabled={locked} onChange={e=>{setEnd(e.target.value);reset();}} className={input}/></label></div>
 <button type="button" disabled={locked||!start||!end||(country==='US'&&!state)} onClick={()=>search()} className="rounded-lg bg-blue-700 text-white px-3 py-2 disabled:opacity-50">{busy?'Searching…':'Find events'}</button>
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 {searched&&<><p role="status" className="text-xs">{events.length} matching events loaded.{!events.length&&!nextPage?' No events found for this location and date range.':''}{nextPage?' More pages are available.':''}</p>
 {events.length>0&&<><label className="block text-sm">Select VEX event<select value={selected} disabled={locked} onChange={e=>setSelected(e.target.value)} className={input}><option value="">Choose an event</option>{events.map(e=><option key={e.code} value={e.code}>{e.start.slice(0,10)} · {e.name}{e.city?` · ${e.city}`:''} · {e.code}</option>)}</select></label><button type="button" disabled={locked||!selected} onClick={()=>onSelect(selected)} className="rounded-lg bg-blue-700 text-white px-3 py-2 disabled:opacity-50">Use selected event</button></>}
 {nextPage&&<button type="button" disabled={locked} onClick={()=>search(true)} className="rounded-lg border border-slate-300 px-3 py-2">Load more events</button>}</>}
 </div>;
}
