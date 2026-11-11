import JudgingPreparation from './JudgingPreparation';
import JudgeAssignmentHistory from './JudgeAssignmentHistory';
import JudgeMatchDelay from './JudgeMatchDelay';
import JudgeConflictOverview from './JudgeConflictOverview';
import JudgingProgress from './JudgingProgress';
import React,{useEffect,useRef,useState} from 'react';
import useUnsavedWork from '../unsavedWork';
import InterviewOptimizer from './InterviewOptimizer';
import JudgeGroupCodes from './JudgeGroupCodes';
import * as scheduleApi from '../interviewScheduleApi';
import {validateInterviews,formatInterviewDisplay} from '../interviewSchedule';
const JudgingPortalPreview=React.lazy(()=>import('./JudgingPortalPreview'));
export default function JudgingInterviews({eventId,sessionId=null,sessionName='',teams,eventTimezone='UTC',eventName='Event',matches=[],division=0,divisions=[],canManage=false,canJudge=false,developerPreview=false,api=scheduleApi}){
 const [entries,setEntries]=useState([]),[duration,setDuration]=useState(10),[groupAssignments,setGroupAssignments]=useState([]),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [completions,setCompletions]=useState({});
 const [planning,setPlanning]=useState(null);
 const [groupRevision,setGroupRevision]=useState(0);
 const version=useRef(0),flight=useRef(false),zone=eventTimezone,draftKey=`refosInterviewDraft:${eventId}:${sessionId||''}`;
 useUnsavedWork(dirty);
 useEffect(()=>{if(dirty)try{localStorage.setItem(draftKey,JSON.stringify({entries,duration,groups:groupAssignments,planning,completions,baseVersion:version.current}));}catch{}},[dirty,entries,duration,groupAssignments,planning,completions,draftKey]);
 const changed=()=>{setDirty(true);setError('');setMessage('');};
 const load=async()=>{setBusy(true);try{const result=await api.loadInterviewSchedule(eventId,sessionId);setEntries(result.value.entries||[]);setDuration(result.value.duration||10);setGroupAssignments(result.value.groups||[]);setPlanning(result.value.planning||null);setCompletions(result.value.completions||{});version.current=result.version;setLoaded(true);setDirty(false);setError('');}catch(e){setError(e.message);}finally{setBusy(false);}};
 useEffect(()=>{load();},[eventId,sessionId,api]);
 useEffect(()=>{const listener=e=>{if(e.detail?.eventId!==eventId)return;if(dirty)setMessage('The saved schedule changed on another device. Your draft is preserved. Reload saved interviews to review the update.');else void load();};window.addEventListener('refos:judging-change',listener);return()=>window.removeEventListener('refos:judging-change',listener);},[eventId,sessionId,dirty]);
 const issue=validateInterviews(entries,duration);
 const saveSchedule=async next=>{
  if(flight.current||validateInterviews(next.entries,next.duration))return;
  flight.current=true;
  setBusy(true);
  try {
   const result=await api.saveInterviewSchedule(eventId,sessionId,next,version.current);
   version.current=result.version;
   setDirty(false);
   localStorage.removeItem(draftKey);
   setMessage('Interview schedule shared with judge groups.');
   setError('');
  }catch(e){setError(e.message);}
  finally{flight.current=false;setBusy(false);}
 };
 const save=()=>saveSchedule({duration:Number(duration),entries,groups:groupAssignments,planning,completions});
 const applyProposal=(proposal,groups,rules,publish)=>{
  const memberships=new Map();
  for(const group of groupAssignments)for(const team of group.teams||[]){
   if(!rules?.replannedTeams?.includes(team))memberships.set(team,group.name);
  }
  for(const group of groups)for(const team of group.teams||[])memberships.set(team,group.name);
  const names=new Set([...groupAssignments.map(g=>g.name),...groups.map(g=>g.name)]);
  const assignments=[...names].map(name=>({
   name,teams:[...memberships].filter(([,group])=>group===name).map(([team])=>team)
  }));
  const next={duration:rules?.minutes||duration,entries:[...entries,...proposal],groups:assignments,planning:rules,completions};
  setDuration(next.duration);
  setEntries(next.entries);
  setGroupAssignments(assignments);
  setPlanning(rules);
  changed();
  if(publish)void saveSchedule(next);
  else setMessage('Interview proposal added to your draft. Save to share it with staff.');
 };
 return <div className="space-y-5">{error&&<p role="alert" className="text-red-700">{error}</p>}{issue&&<p role="alert" className="text-red-700">{issue}</p>}{message&&<p role="status">{message}</p>}{dirty&&<p className="mb-3">Unsaved changes — save the optimized schedule before leaving.</p>}<section aria-labelledby="judging-groups"><h2 id="judging-groups" className="mb-2 text-xl font-bold">{developerPreview?'1. Set up judging':'1. Set up judge groups & conflicts'}</h2><p className="mb-3">{developerPreview?"Add each group, then issue individual judge codes.":"Create group logins so judges can declare their conflicts before teams are assigned."}</p><JudgeGroupCodes inline quickSetup={developerPreview} eventId={eventId} entries={entries} groups={groupAssignments} onDeleted={async()=>{localStorage.removeItem(draftKey);await load();}} onChanged={()=>setGroupRevision(n=>n+1)}/><details className="my-3 rounded border p-3"><summary className="min-h-[44px] cursor-pointer py-2 font-semibold">Judge readiness & team requests</summary><JudgingPreparation eventId={eventId} teams={teams} revision={groupRevision}/></details>{developerPreview&&<React.Suspense fallback={<p>Loading judge access…</p>}><JudgingPortalPreview eventId={eventId} eventName={eventName} groupRevision={groupRevision}/></React.Suspense>}
 <JudgeConflictOverview teams={teams} inline quickSetup={developerPreview} eventId={eventId} revision={groupRevision}/>
 </section><section aria-labelledby="judging-plan"><h2 id="judging-plan" className="mb-2 text-xl font-bold">2. Plan interviews</h2><p className="mb-3">{developerPreview?'Choose a time window, review the proposal, then publish it to judges.':'Enter your interview window and group names, then generate a proposal.'}</p>
  <InterviewOptimizer key={developerPreview?undefined:groupRevision} inline streamlined={developerPreview} eventId={eventId} eventName={eventName} sessionName={sessionName} teams={teams} entries={entries} matches={matches} zone={zone} onSave={save} canSave={dirty&&!issue} disabled={!loaded||busy} onApply={applyProposal}/>
 </section><section aria-labelledby="judging-review"><h2 id="judging-review" className="mb-2 text-xl font-bold">3. Review & save interviews</h2><div className="mb-5 rounded-xl border bg-white p-4 dark:bg-slate-800"><h3 className="min-h-[44px] font-bold">Saved group interviews</h3><div className="mt-3 space-y-3"><details open={!developerPreview}><summary className="min-h-[44px] cursor-pointer py-2">Schedule maintenance</summary><button disabled={busy} className="min-h-[44px] rounded border px-3" onClick={()=>{if(!dirty||confirm('Discard unsaved changes and reload?'))load();}}>Reload saved interviews</button><button disabled={busy} className="ml-2 min-h-[44px] rounded border px-3" onClick={()=>{try{const draft=JSON.parse(localStorage.getItem(draftKey)||'null');if(!draft||!Array.isArray(draft.entries))throw Error('No saved draft.');setEntries(draft.entries);setDuration(draft.duration);setGroupAssignments(draft.groups||[]);setPlanning(draft.planning||null);setCompletions(draft.completions||{});version.current=draft.baseVersion;changed();}catch(e){setError(e.message);}}}>Recover saved draft</button></details><div className="flex flex-wrap gap-2"><button disabled={busy||!dirty||Boolean(issue)} className="min-h-[44px] rounded bg-sky-800 px-3 text-white" onClick={save}>Save interview changes</button>{(canManage||canJudge)&&<button disabled={busy||(!entries.length&&!groupAssignments.some(g=>g.teams?.length))} className="min-h-[44px] rounded border border-red-300 px-3 text-red-700" onClick={()=>{if(confirm('Delete all generated interviews and judge-group assignments for this event/session? Interview progress will also be cleared. Save interview changes to apply this deletion.')){setEntries([]);setGroupAssignments([]);setCompletions({});setPlanning(null);changed();setMessage('All generated interviews removed from the draft. Save interview changes to apply the deletion.');}}}>Delete all generated interviews</button>}</div><p className="text-sm">Removing one interview clears its time; its team stays assigned for rescheduling. Save interview changes to share removals with judges.</p>{!entries.length&&<p>No interviews saved yet.</p>}{entries.map(r=><div key={r.id} className="rounded border p-3"><b>{r.team} · {r.group||'Unassigned group'}</b><p>{formatInterviewDisplay(r.start,zone)} · {r.minutes} minutes</p><button disabled={busy} className="min-h-[44px] rounded border px-3" onClick={()=>{if(confirm(`Remove the interview for ${r.team} from the draft?`)){setEntries(old=>old.filter(e=>e.id!==r.id));changed();}}}>Remove interview for {r.team}</button></div>)}</div></div></section>
 <section aria-labelledby="judging-track"><h2 id="judging-track" className="mb-2 text-xl font-bold">4. Track interviews & resolve conflicts</h2><p className="mb-3">Review completion across all groups and move teams when a judge conflict arises.</p><JudgeMatchDelay eventId={eventId}/><JudgingProgress zone={zone} inline canMove={(canManage||canJudge)&&!dirty&&!busy} onMoved={load} revision={version.current} eventId={eventId} sessionId={sessionId} teams={teams} api={api}/>
 <JudgeAssignmentHistory zone={zone} eventId={eventId} sessionId={sessionId} revision={version.current}/></section></div>;
}
