import React,{useEffect,useState} from 'react';
import {listJudgeAssignmentHistory} from '../judgeGroupApi';
import {formatInterviewDisplay} from '../interviewSchedule';
export default function JudgeAssignmentHistory({eventId,sessionId,revision=0,zone='UTC'}){
 const [rows,setRows]=useState([]),[error,setError]=useState('');const load=async()=>{try{setRows(await listJudgeAssignmentHistory(eventId));setError('');}catch(e){setError(e.message);}};useEffect(()=>{load();},[eventId,revision]);
 return <section className="rounded-xl border bg-white p-4 dark:bg-slate-800"><h3 className="font-bold">Assignment history</h3><button className="min-h-[44px] rounded border px-3 my-2" onClick={load}>Refresh assignment history</button>{error&&<p role="alert" className="text-red-700">{error}</p>}<ul className="space-y-2">{rows.filter(r=>(r.session_id||null)===(sessionId||null)).map(r=><li key={r.id}>{r.team}: {r.from_group||'Unassigned'} → {r.to_group||'Unassigned'} · {formatInterviewDisplay(r.changed_at,zone)} · Actor {r.actor_name||r.actor||'System'}</li>)}</ul>{!rows.length&&<p>No assignment changes recorded since history was enabled.</p>}</section>;
}
