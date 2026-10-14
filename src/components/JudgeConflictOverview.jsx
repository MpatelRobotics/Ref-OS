import React,{useEffect,useState} from 'react';
import {listJudgeGroupConflicts} from '../judgeGroupApi';
export default function JudgeConflictOverview({eventId,inline=false,revision=0}){
 const [profiles,setProfiles]=useState([]),[error,setError]=useState('');const load=()=>listJudgeGroupConflicts(eventId).then(p=>{setProfiles(p);setError('');}).catch(e=>setError(e.message));useEffect(()=>{load();},[eventId,revision]);
 const Container=inline?'section':'details',Title=inline?'h3':'summary';
 return <Container className="mb-5 rounded-xl border bg-white p-4 dark:bg-slate-800"><Title className="min-h-[44px] cursor-pointer font-bold">Judge-group conflict declarations</Title><p className="my-3 text-sm">Create group logins first. Each group signs in and declares conflicts before the optimizer assigns teams. Conflicts reported after assignment require review and reassignment.</p><button className="min-h-[44px] rounded border px-3" onClick={load}>Refresh conflict declarations</button>{error&&<p role="alert" className="text-red-700">{error}</p>}{profiles.map(p=><section key={p.name} className="my-3 rounded border p-3"><h3 className="font-bold">{p.name} · {p.version>0?'Declared':'Not yet declared'}</h3><p>Excluded teams: {p.conflict_teams.join(', ')||'None listed'}</p><p className="whitespace-pre-wrap break-words">{p.affiliations}</p></section>)}</Container>;
}
