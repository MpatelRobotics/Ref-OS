import React,{useEffect,useState} from 'react';
import {lookupVexTeamEvents} from '../api';
const key=number=>'refos:vex-team-events:'+number;
function cached(number){try{const value=JSON.parse(localStorage.getItem(key(number)));return value?.number===number&&Array.isArray(value.events)?value:null;}catch{return null;}}
export function sortTeamEvents(events,today=new Date().toISOString().slice(0,10)) {
 return [...events].sort((a,b)=>{const ad=String(a.start||'').slice(0,10),bd=String(b.start||'').slice(0,10);const au=ad>=today,bu=bd>=today;return au!==bu?(au?-1:1):au?ad.localeCompare(bd):bd.localeCompare(ad);});
}
export default function TeamRegisteredEvents({number,onLookup=lookupVexTeamEvents}) {
 const [data,setData]=useState(()=>cached(number)),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;const saved=cached(number);setData(saved);setError('');setBusy(false);
 if(navigator.onLine&&(!saved||Date.now()-Date.parse(saved.checkedAt)>900000)){setBusy(true);onLookup(number).then(result=>{try{localStorage.setItem(key(number),JSON.stringify(result));}catch{}if(live)setData(result);}).catch(e=>{if(live)setError(e.message||'Event lookup unavailable.');}).finally(()=>{if(live)setBusy(false);});}return()=>{live=false;};},[number,onLookup]);
 async function refresh(){setBusy(true);setError('');try{const result=await onLookup(number);try{localStorage.setItem(key(number),JSON.stringify(result));}catch{}setData(result);}catch(e){setError(e.message||'Event lookup unavailable.');}finally{setBusy(false);}}
 return <section aria-label="Registered and past events" className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
 <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Registered &amp; Past Events</h2><button type="button" disabled={busy||!navigator.onLine} onClick={refresh} className="min-h-[44px] border rounded-lg px-3 py-2">{busy?'Loading events…':'Refresh events'}</button></div>
 <p className="text-sm text-slate-500">VEX-reported team events from the past year through the next year. Upcoming events appear first. This list does not confirm attendance or registration status.</p>
 {data&&<p className="text-sm text-slate-500">Last checked {new Date(data.checkedAt).toLocaleString()}{!navigator.onLine?' · Saved offline copy':''}</p>}
 {error&&<p role="alert" className="text-sm text-red-600">{error}{data?' Showing the saved list.':''}</p>}
 {!data&&!busy&&<p className="text-sm">{navigator.onLine?'No saved event list yet.':'Connect to load this team’s events. Saved lists remain available offline.'}</p>}
 {data&&!data.events.length&&<p className="text-sm">No events were returned for this team in this date range.</p>}
 <ul className="space-y-2">{sortTeamEvents(data?.events||[]).map(event=><li key={event.id} className="border-t border-slate-200 dark:border-slate-700 pt-2">{event.url ? <a className="block py-2 font-semibold text-blue-700 dark:text-blue-300" href={event.url} target="_blank" rel="noopener noreferrer">{event.name||event.code}</a> : <p className="font-semibold py-2">{event.name||event.code}</p>}<p className="text-sm">{event.code} · {event.start?new Date(event.start).toLocaleDateString():'Date unavailable'}</p><p className="text-sm text-slate-500">{event.location||'Location unavailable'}</p></li>)}</ul>
 </section>;
}

