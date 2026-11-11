import ConflictTeamSelect from './ConflictTeamSelect';
import React,{useEffect,useState} from 'react';
import {listJudgeGroupConflicts,saveJudgeGroupConflicts} from '../judgeGroupApi';
function ConflictEditor({eventId,profile,onSaved,roster}){
 const [teams,setTeams]=useState(profile.conflict_teams),[notes,setNotes]=useState(profile.affiliations),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const save=async()=>{setBusy(true);try{await saveJudgeGroupConflicts({p_event:eventId,p_group:profile.name,p_teams:teams,p_affiliations:notes.trim(),p_version:profile.version});await onSaved();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="my-3 rounded border p-3"><h3 className="font-bold">{profile.name} · {profile.version>0?'Declared':'Not yet declared'}</h3><ConflictTeamSelect label={`Conflicting / affiliated teams for ${profile.name}`} teams={roster} value={teams} onChange={setTeams} disabled={busy}/><label className="block mt-2">Affiliations and notes for {profile.name}<textarea maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)} className="block w-full min-h-[44px] rounded border bg-transparent p-2"/></label><p className="text-sm my-2">Select all teams to exclude. Leave the selection empty if this group has no conflicts.</p>{error&&<p role="alert" className="text-red-700">{error}</p>}<button disabled={busy} className="min-h-[44px] rounded border px-3" onClick={save}>Save conflicts for {profile.name}</button></section>;
}
export default function JudgeConflictOverview({eventId,teams=[],inline=false,revision=0,quickSetup=false}){
 const [profiles,setProfiles]=useState([]),[error,setError]=useState('');const load=()=>listJudgeGroupConflicts(eventId).then(p=>{setProfiles(p);setError('');}).catch(e=>setError(e.message));useEffect(()=>{load();},[eventId,revision]);
 const [saving,setSaving]=useState(false);
 const declareNoConflicts=async name=>{
  setSaving(true);
  try {
   await saveJudgeGroupConflicts({p_event:eventId,p_group:name,p_teams:[],p_affiliations:'',p_version:0});
   await load();
  }catch(e){setError(e.message);}
  finally{setSaving(false);}
 };
 if(quickSetup)return <section className="space-y-3 rounded-xl border bg-white p-4 dark:bg-slate-800">
  <h3 className="text-xl font-bold">Declare group conflicts</h3>
  <p>After issuing individual codes, confirm each group has no conflicts or enter the teams they cannot interview.</p>
  {error&&<p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
  {profiles.filter(profile=>profile.enabled).map(profile=><article key={profile.name} className="space-y-2 rounded border p-3">
   <h4 className="font-semibold">{profile.name}</h4>
   <p>{profile.version>0?'Conflicts declared':'Conflict declaration needed'}</p>
   {profile.version===0&&<button disabled={saving} onClick={()=>declareNoConflicts(profile.name)} className="min-h-[44px] rounded border px-3">Confirm no conflicts</button>}
   <details>
    <summary className="min-h-[44px] cursor-pointer py-2">{profile.version>0?'Edit conflicts':'Enter conflicts'}</summary>
    <ConflictEditor key={profile.version} eventId={eventId} profile={profile} roster={teams} onSaved={load}/>
   </details>
  </article>)}
  <button disabled={saving} onClick={load} className="min-h-[44px] rounded border px-3">Refresh conflict declarations</button>
 </section>;
 const Container=inline?'section':'details',Title=inline?'h3':'summary';
 return <Container className="mb-5 rounded-xl border bg-white p-4 dark:bg-slate-800"><Title className="min-h-[44px] font-bold">Group conflicts & affiliations</Title><p className="my-3 text-sm">Enter conflicts here for each group, or let judges declare them when they sign in. New conflicts on assigned teams need review and reassignment.</p><button className="min-h-[44px] rounded border px-3" onClick={load}>Refresh conflict declarations</button>{error&&<p role="alert" className="text-red-700">{error}</p>}{!profiles.length&&<p className="mt-3">Create your judge groups above first.</p>}{profiles.map(p=><ConflictEditor key={p.name+':'+p.version} eventId={eventId} profile={p} roster={teams} onSaved={load}/>)}</Container>;
}
