import React,{useEffect,useRef,useState} from 'react';
import useUnsavedWork from '../unsavedWork';
import InterviewOptimizer from './InterviewOptimizer';
import JudgeGroupCodes from './JudgeGroupCodes';
import * as scheduleApi from '../interviewScheduleApi';
import {validateInterviews,formatInterviewDisplay} from '../interviewSchedule';
export default function JudgingInterviews({eventId,sessionId=null,sessionName='',teams,eventTimezone='UTC',eventName='Event',matches=[],api=scheduleApi}){
 const [entries,setEntries]=useState([]),[duration,setDuration]=useState(10),[groupAssignments,setGroupAssignments]=useState([]),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const version=useRef(0),flight=useRef(false),zone=eventTimezone,draftKey=`refosInterviewDraft:${eventId}:${sessionId||''}`;
 useUnsavedWork(dirty);
 useEffect(()=>{if(dirty)try{localStorage.setItem(draftKey,JSON.stringify({entries,duration,groups:groupAssignments,baseVersion:version.current}));}catch{}},[dirty,entries,duration,groupAssignments,draftKey]);
 const changed=()=>{setDirty(true);setError('');setMessage('');};
 const load=async()=>{setBusy(true);try{const result=await api.loadInterviewSchedule(eventId,sessionId);setEntries(result.value.entries||[]);setDuration(result.value.duration||10);setGroupAssignments(result.value.groups||[]);version.current=result.version;setLoaded(true);setDirty(false);setError('');}catch(e){setError(e.message);}finally{setBusy(false);}};
 useEffect(()=>{load();},[eventId,sessionId,api]);
 const issue=validateInterviews(entries,duration);
 const save=async()=>{if(flight.current||issue)return;flight.current=true;setBusy(true);try{const result=await api.saveInterviewSchedule(eventId,sessionId,{duration:Number(duration),entries,groups:groupAssignments},version.current);version.current=result.version;setDirty(false);localStorage.removeItem(draftKey);setMessage('Optimized interviews saved for judge groups.');setError('');}catch(e){setError(e.message);}finally{flight.current=false;setBusy(false);}};
 return <>{error&&<p role="alert" className="text-red-700">{error}</p>}{issue&&<p role="alert" className="text-red-700">{issue}</p>}{message&&<p role="status">{message}</p>}{dirty&&<p className="mb-3">Unsaved changes — save the optimized schedule before leaving.</p>}
  <InterviewOptimizer eventName={eventName} sessionName={sessionName} teams={teams} entries={entries} matches={matches} zone={zone} onSave={save} canSave={dirty&&!issue} disabled={!loaded||busy} onApply={(proposal,groups)=>{setGroupAssignments(groups||[]);setEntries(old=>[...old,...proposal]);changed();setMessage('Interview proposal added to your draft. Save to share it with staff.');}}/>
 <details className="mb-5 rounded-xl border bg-white p-4 dark:bg-slate-800"><summary className="min-h-[44px] font-bold cursor-pointer">Saved group interviews</summary><div className="mt-3 space-y-3"><button disabled={busy} className="min-h-[44px] rounded border px-3" onClick={()=>{if(!dirty||confirm('Discard unsaved changes and reload?'))load();}}>Reload saved interviews</button><button disabled={busy} className="ml-2 min-h-[44px] rounded border px-3" onClick={()=>{try{const draft=JSON.parse(localStorage.getItem(draftKey)||'null');if(!draft||!Array.isArray(draft.entries))throw Error('No saved draft.');setEntries(draft.entries);setDuration(draft.duration);setGroupAssignments(draft.groups||[]);version.current=draft.baseVersion;changed();}catch(e){setError(e.message);}}}>Recover saved draft</button>{!entries.length&&<p>No interviews saved yet.</p>}{entries.map(r=><div key={r.id} className="rounded border p-3"><b>{r.team} · {r.group||'Unassigned group'}</b><p>{formatInterviewDisplay(r.start,zone)} · {r.panel} · {r.minutes} minutes</p><button disabled={busy} className="min-h-[44px] rounded border px-3" onClick={()=>{if(confirm(`Remove the interview for ${r.team} from the draft?`)){setEntries(old=>old.filter(e=>e.id!==r.id));changed();}}}>Remove interview for {r.team}</button></div>)}</div></details>
 <JudgeGroupCodes eventId={eventId} entries={entries} groups={groupAssignments}/>
 </>;
}
