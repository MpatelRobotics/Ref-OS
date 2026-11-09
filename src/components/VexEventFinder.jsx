import {COUNTRIES} from '../geography.js';
import FilteredSelect from './FilteredSelect.jsx';
import {matchesRefereeFilters} from '../refereeEventFilters';
import React,{useState} from 'react';
const STATES='Alabama,Alaska,Arizona,Arkansas,California,Colorado,Connecticut,Delaware,District of Columbia,Florida,Georgia,Hawaii,Idaho,Illinois,Indiana,Iowa,Kansas,Kentucky,Louisiana,Maine,Maryland,Massachusetts,Michigan,Minnesota,Mississippi,Missouri,Montana,Nebraska,Nevada,New Hampshire,New Jersey,New Mexico,New York,North Carolina,North Dakota,Ohio,Oklahoma,Oregon,Pennsylvania,Rhode Island,South Carolina,South Dakota,Tennessee,Texas,Utah,Vermont,Virginia,Washington,West Virginia,Wisconsin,Wyoming,Puerto Rico,Guam,US Virgin Islands'.split(',');
const STATE_CODES='AL,AK,AZ,AR,CA,CO,CT,DE,DC,FL,GA,HI,ID,IL,IN,IA,KS,KY,LA,ME,MD,MA,MI,MN,MS,MO,MT,NE,NV,NH,NJ,NM,NY,NC,ND,OH,OK,OR,PA,RI,SC,SD,TN,TX,UT,VT,VA,WA,WV,WI,WY,PR,GU,VI'.split(',');
const dateString=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export default function VexEventFinder({onSearch,onSelect,onBusy=()=>{},disabled=false,showFilters=true,expectedProgram}) {
 const [area,setArea]=useState('US'),[internationalCountry,setInternationalCountry]=useState('');
 const country=area==='US'?'US':internationalCountry;
 const requiredProgram=({iq:'VIQRC',v5:'V5RC',vexu:'VURC'})[expectedProgram];
 const [program,setProgram]=useState('all'),[eventType,setEventType]=useState('all');
 const selectedProgram=requiredProgram||program;
 const [state,setState]=useState(''),[start,setStart]=useState(()=>dateString(new Date())),[end,setEnd]=useState(()=>dateString(new Date(Date.now()+90*86400000)));
 const [events,setEvents]=useState([]),[nextPage,setNextPage]=useState(null),[searched,setSearched]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState('');
 const reset=()=>{setEvents([]);setNextPage(null);setSearched(false);setSelected('');setError('');};
 const search=async(more=false)=>{setBusy(true);onBusy(true);setError('');try{const result=await onSearch({country,state,start,end,page:more?nextPage:1,...((showFilters||requiredProgram)?{program:selectedProgram,eventType}:{})});setEvents(old=>[...new Map((more?[...old,...result.events]:result.events).map(e=>[e.code,e])).values()].sort((a,b)=>a.start.localeCompare(b.start)||a.name.localeCompare(b.name)));setNextPage(result.nextPage);setSearched(true);if(!more)setSelected('');}catch(e){setError(e.message||'Could not search events.');}finally{setBusy(false);onBusy(false);}};
 const visible=events.filter(event=>matchesRefereeFilters(event,selectedProgram,eventType));
 const locked=busy||disabled;const input='w-full min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-2';
 return <div className="border-t border-sky-200 dark:border-sky-800 pt-3 space-y-2">
 <h3 className="text-sm font-semibold">Or find an event by location</h3>
 <p className="text-xs text-slate-500">Search USA or international competitions. Select a date range of up to one year.</p>
 {showFilters&&<div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Program<select aria-label="Event search program" value={selectedProgram} disabled={locked||Boolean(requiredProgram)} className={input} onChange={e=>{setProgram(e.target.value);reset();}}><option value="all">All programs</option><option value="V5RC">VEX V5 (V5RC)</option><option value="VIQRC">VEX IQ (VIQRC)</option><option value="VURC">VEX U (VURC)</option></select></label><label className="block text-sm">Event type<select aria-label="Event search type" value={eventType} disabled={locked} className={input} onChange={e=>{setEventType(e.target.value);reset();}}><option value="all">All event types</option><option value="tournament">Tournament</option><option value="league">League</option><option value="signature">Signature event</option></select></label></div>}
 <label className="block text-sm">Search region<select aria-label="Search region" value={area} disabled={locked} className={input} onChange={e=>{setArea(e.target.value);setState('');setInternationalCountry('');reset();}}><option value="US">USA</option><option value="international">International</option></select></label>
 {area==='US'?<FilteredSelect label="State or territory" searchLabel="Search states or territories" placeholder="Select state" value={state} disabled={locked} onChange={value=>{setState(value);reset();}} options={STATES.map((s,i)=>({value:s,label:s,keywords:STATE_CODES[i]}))}/>:<FilteredSelect label="Country" searchLabel="Search countries" placeholder="Select country" value={internationalCountry} disabled={locked} onChange={value=>{setInternationalCountry(value);reset();}} options={COUNTRIES.filter(c=>c.code!=='US').map(c=>({value:c.code,label:c.name,keywords:c.keywords}))}/>}

 <div className="grid grid-cols-2 gap-2"><label className="block min-w-0 text-sm">From date<input type="date" value={start} disabled={locked} onChange={e=>{setStart(e.target.value);reset();}} className={input}/></label><label className="block min-w-0 text-sm">To date<input type="date" value={end} disabled={locked} onChange={e=>{setEnd(e.target.value);reset();}} className={input}/></label></div>
 <button type="button" disabled={locked||!country||!start||!end||(country==='US'&&!state)} onClick={()=>search()} className="rounded-lg bg-blue-700 text-white px-3 py-2 disabled:opacity-50">{busy?'Searching…':'Find events'}</button>
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 {searched&&<><p role="status" className="text-xs">{visible.length} matching events loaded.{!visible.length&&!nextPage?' No events found for this location and date range.':''}{nextPage?' More pages are available.':''}</p>
 {visible.length>0&&<><label className="block text-sm">Select VEX event<select value={selected} disabled={locked} onChange={e=>setSelected(e.target.value)} className={input}><option value="">Choose an event</option>{visible.map(e=><option key={e.code} value={e.code}>{e.start.slice(0,10)} · {e.name}{e.city?` · ${e.city}`:''} · {e.code}</option>)}</select></label><button type="button" disabled={locked||!selected} onClick={()=>onSelect(selected)} className="rounded-lg bg-blue-700 text-white px-3 py-2 disabled:opacity-50">Use selected event</button></>}
 {nextPage&&<button type="button" disabled={locked} onClick={()=>search(true)} className="rounded-lg border border-slate-300 px-3 py-2">Load more events</button>}</>}
 </div>;
}
