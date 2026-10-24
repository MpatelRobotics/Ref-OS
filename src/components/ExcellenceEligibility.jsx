import React,{useState} from 'react';
import {excellenceEligibility} from '../excellenceEligibility.js';
export default function ExcellenceEligibility({teams=[],skills=[]}){
 const [filter,setFilter]=useState('candidates');
 const rows=excellenceEligibility(teams,skills);
 const candidates=rows.filter(r=>r.performance);
 return <details className="mb-4 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
 <summary className="min-h-[48px] cursor-pointer px-4 py-3 font-semibold">Excellence Award · Top 40% ({candidates.length})</summary>
 <div className="space-y-3 p-4 pt-0"><p className="text-sm">Tracks every team’s current qualification, overall Skills, and Autonomous Coding Skills rankings. Teams must be in the top 40% in all three, with an Autonomous Coding score above zero. Updates automatically when new rankings or Skills data arrive.</p>
 <p className="text-sm text-slate-500 dark:text-slate-400">Ranking criteria only; this is not the final Excellence Award decision. Teams without Skills scores count as zero.</p>
 <label className="block font-medium">Show teams<select className="mt-1 min-h-[44px] w-full rounded-lg border bg-white p-2 text-slate-900 dark:bg-slate-900 dark:text-white" value={filter} onChange={e=>setFilter(e.target.value)}><option value="candidates">Meet all three ranking criteria ({candidates.length})</option><option value="all">All teams ({rows.length})</option></select></label>
 {!rows.length?<p>No teams loaded. Import the event roster first.</p>:filter==='candidates'&&!candidates.length?<p>No teams currently meet all three ranking criteria.</p>:null}
 {(filter==='all'?rows:candidates).map(row=><div key={row.team.number} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><p><b>{row.team.number}</b> {row.team.name} · {row.pending?'Waiting for this team’s ranking data':row.performance?'Meets top 40% criteria':'Outside top 40% criteria'}</p>
 <p className="mt-2 text-sm">Qualification #{row.ranks.qualification||'—'} · Skills #{row.ranks.skills||'—'} · Autonomous Coding #{row.ranks.autonomous||'—'} · Cutoff #{row.cutoff||'—'}</p>
 </div>)}
 </div></details>;
}
