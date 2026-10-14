import React from 'react';
import {tmMatchIdentity} from '../tmMatchIdentity';
import {interviewMatchLabel} from '../interviewMatchWindow';
export default function JudgeCurrentMatch({activities=[],now=Date.now()}){
 const current=activities.flatMap(activity=>{const value=activity.value;if(!value?.updatedAt||now-value.updatedAt>90000)return [];return (value.fieldSets||[]).filter(set=>set.connected).flatMap(set=>(set.fields||[]).filter(field=>field.status==='playing').map(field=>({key:`${activity.key}:${set.id}:${field.id}`,set,field,identity:tmMatchIdentity(field.match)}))).filter(row=>row.identity);});
 return <section aria-label="Current TM match" className="rounded-xl border bg-white p-4 dark:bg-slate-800"><h2 className="text-lg font-bold">Current match</h2>{!current.length?<p className="mt-2 text-sm">No current match reported by the TM connector.</p>:<div className="mt-2 space-y-2">{current.map(row=><p key={row.key} className="rounded border border-green-600 bg-green-50 p-3 text-green-900"><b>{interviewMatchLabel(row.identity)}</b> · Playing now <span className="text-sm">· {row.set.name} · {row.field.name}</span></p>)}</div>}</section>;
}

