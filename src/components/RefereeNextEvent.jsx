import React from 'react';
import {downloadRefereeCalendar,upcomingRefereeEvents} from '../refereeCalendar';
export default function RefereeNextEvent({events,plans,external,busy,onOpen}){
 const upcoming=upcomingRefereeEvents(events,plans,external);
 const next=upcoming[0];
 return <section aria-label="My next event" className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-700 dark:bg-indigo-950/30"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">My next event</h2><button disabled={!upcoming.length||busy} onClick={()=>downloadRefereeCalendar(upcoming)} className="min-h-[44px] rounded-xl border border-indigo-300 bg-white px-4 py-2 font-semibold text-indigo-900 disabled:opacity-50">Export upcoming events</button></div>
 {next?<><p className="font-semibold">{next.name}</p><p className="text-sm">{next.startDate}{next.endDate&&next.endDate!==next.startDate?` – ${next.endDate}`:''} · {next.code}</p>{next.location&&<p className="text-sm">{next.location}</p>}<button disabled={busy} className="min-h-[44px] rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50" onClick={()=>onOpen(next)}>Open next event</button></>:<p className="text-sm">No dated upcoming events yet. In My events, find an event and mark “I’m going.”</p>}
 <p className="text-xs text-slate-600 dark:text-slate-300">Calendar downloads include dated upcoming events as all-day entries. Undated events stay in My events. Import the .ics file into your calendar; it does not update automatically.</p></section>;
}
