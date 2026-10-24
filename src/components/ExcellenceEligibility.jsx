import React,{useState} from 'react';
import {excellenceEligibility,excellenceSnapshot,EXCELLENCE_CHECKS} from '../excellenceEligibility.js';
export default function ExcellenceEligibility({teams=[],skills=[],review={},onSave}){
 const [filter,setFilter]=useState('all'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const rows=excellenceEligibility(teams,skills,review);
 async function save(next){setBusy(true);setError('');try{await onSave(next);}catch(e){setError(e.message||'Could not save checklist.');}finally{setBusy(false);}}
 const eligible=rows.filter(r=>r.eligible).length;
 return <details className="mb-4 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
 <summary className="min-h-[48px] cursor-pointer px-4 py-3 font-semibold">Excellence Award eligible teams ({eligible})</summary>
 <div className="space-y-3 p-4 pt-0"><p className="text-sm">Evaluates every team in this event roster, including teams with no nominations. Uses the attached checklist’s top 40% of qualification, overall Skills, and Autonomous Coding Skills rankings. Autonomous Coding score must be above zero. Teams without Skills scores count as zero.</p>
 <p className="text-sm">Ranking candidates still need all five judging criteria confirmed. Eligibility is provisional until qualification matches and Skills are complete and the imported rankings are final. If ranking data changes, final confirmation must be checked again. Tied Autonomous Coding scores share a rank; confirm any boundary ties with the Judge Advisor.</p>
 {onSave&&<fieldset disabled={busy} className="space-y-3 disabled:opacity-50">
 <label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={!!review.final&&review.snapshot===excellenceSnapshot(teams,skills)} onChange={e=>save({...review,final:e.target.checked,snapshot:excellenceSnapshot(teams,skills)})}/>Qualification matches and Skills are complete; imported rankings are final</label>
 <label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={!!review.splitLevels} onChange={e=>save({...review,splitLevels:e.target.checked,final:false})}/>Two grade-specific Excellence Awards (assign every team’s grade level below)</label>
 </fieldset>}
 <label className="block font-medium">Show teams<select className="mt-1 min-h-[44px] w-full rounded-lg border bg-white p-2 text-slate-900 dark:bg-slate-900 dark:text-white" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All teams ({rows.length})</option><option value="eligible">Eligible — all criteria confirmed ({eligible})</option><option value="candidates">Meet ranking criteria ({rows.filter(r=>r.performance).length})</option></select></label>
 {error&&<p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
 {!rows.length&&<p>No teams loaded. Import the event roster first.</p>}
 {rows.filter(r=>filter==='all'||(filter==='eligible'?r.eligible:r.performance)).map(row=><details key={row.team.number} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><summary className="min-h-[44px] cursor-pointer"><b>{row.team.number}</b> {row.team.name} · {row.eligible?'Eligible':row.pending?'Needs ranking data or grade assignment':row.performance?'Ranking criteria met · judging confirmation needed':'Ranking criteria not met'}</summary>
 <p className="my-2 text-sm">Qualification #{row.ranks.qualification||'—'} · Skills #{row.ranks.skills||'—'} · Autonomous Coding #{row.ranks.autonomous||'—'} · Cutoff #{row.cutoff||'—'}{review.splitLevels?' · '+row.group:''}</p>
 {review.splitLevels&&<label className="block">Grade level<select disabled={!onSave||busy} className="my-2 min-h-[44px] w-full rounded-lg border bg-white p-2 text-slate-900 dark:bg-slate-900 dark:text-white" value={review.levels?.[row.team.number]||''} onChange={e=>save({...review,final:false,levels:{...review.levels,[row.team.number]:e.target.value}})}><option value="">Choose grade level</option><option value="elementary">Elementary</option><option value="middle">Middle school</option><option value="high">High school</option></select></label>}
 <fieldset disabled={!onSave||busy} className="space-y-2">{EXCELLENCE_CHECKS.map(([key,label])=><label key={key} className="flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={row.checks[key]===true} onChange={e=>save({...review,teams:{...review.teams,[row.team.number]:{...row.checks,[key]:e.target.checked}}})}/>{label}</label>)}</fieldset>
 </details>)}
 </div></details>;
}
