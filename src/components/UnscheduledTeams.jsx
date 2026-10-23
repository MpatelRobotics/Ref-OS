import React from 'react';
export default function UnscheduledTeams({teams=[],query='',onOpen,robots=false}) {
 if (!teams.length) return null;
 const q=query.trim().toLowerCase();
 const filtered=teams.filter(t=>!q||t.number.toLowerCase().includes(q)||(t.name||'').toLowerCase().includes(q)).sort((a,b)=>a.number.localeCompare(b.number,undefined,{numeric:true}));
 return <details key={q ? 'search' : 'browse'} open={q ? true : undefined} className="mt-6 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
  <summary className="min-h-[44px] cursor-pointer px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Not in match list ({teams.length})</summary>
  <div className="px-4 pb-4"><p className="mb-3 text-sm text-slate-500 dark:text-slate-400">These teams are kept here because they have no matches in this schedule. Their records and robot photos are still saved.</p>
   {!filtered.length ? <p className="text-sm text-slate-500">No matching teams in this section.</p> : <ul className="space-y-2">{filtered.map(t=><li key={t.number}><button type="button" onClick={()=>onOpen(t.number)} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left dark:border-slate-700"><span className="font-mono font-bold">{t.number}</span><span className="flex-1 text-sm">{t.name}</span><span className="text-sm font-semibold">{robots ? 'View robot' : 'View team'}</span></button></li>)}</ul>}
  </div>
 </details>;
}
