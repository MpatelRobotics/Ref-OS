import React,{useEffect,useState} from 'react';
import {listEventSettings} from '../api';
import {matchDelayEstimates} from '../judgingInsights';
import {interviewMatchLabel} from '../interviewMatchWindow';
export default function JudgeMatchDelay({eventId,settings}){
 const [rows,setRows]=useState(settings||[]),[now,setNow]=useState(Date.now()),[error,setError]=useState('');useEffect(()=>{if(settings){setRows(settings);return;}const load=()=>listEventSettings(eventId).then(value=>setRows(Object.entries(value).map(([key,row])=>({key,value:row.value})))).catch(()=>setError('Match timing unavailable.'));load();const id=setInterval(load,15000);return()=>clearInterval(id);},[eventId,settings]);useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),5000);return()=>clearInterval(id);},[]);const estimates=matchDelayEstimates(rows,now);
 return <section className="rounded-xl border bg-white p-4 dark:bg-slate-800"><h3 className="font-bold">TM match-delay estimate</h3>{error&&<p>{error}</p>}{estimates.map(e=><p key={e.key}>{interviewMatchLabel(e.identity)} · {e.set} · {e.minutes>0?e.minutes+' minutes late':e.minutes<0?Math.abs(e.minutes)+' minutes early':'On schedule'} at observed start</p>)}{!estimates.length&&<p className="text-sm">Waiting for a TM match-start event and its imported scheduled time. Reconnect using the updated connector; estimates require an observed start.</p>}</section>;
}
