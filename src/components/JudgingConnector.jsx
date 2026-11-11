import React,{useEffect,useState} from 'react';
import * as api from '../api';
import JudgingInterviews from './JudgingInterviews';
import {loadJudgingWorkspace,subscribeJudgingWorkspace} from '../judgingConnectorApi';

function Nominations({rows,teams}) {
 const [query,setQuery]=useState('');
 return <section className="space-y-4"><h2 className="text-2xl font-bold">Live nominations</h2><p>Nominations submitted in Ref-OS appear here automatically.</p><label className="block">Search team, award or nomination<input value={query} onChange={e=>setQuery(e.target.value)} className="mt-1 min-h-[44px] w-full rounded border bg-transparent p-3"/></label>
  {!rows.length&&<p>No nominations submitted yet.</p>}{rows.filter(n=>(n.team+' '+n.award+' '+n.reason).toLowerCase().includes(query.toLowerCase())).map(n=><article key={n.id} className="rounded-xl border bg-white p-4 dark:bg-slate-900"><h3 className="text-lg font-bold">{n.team} · {teams.find(t=>t.number===n.team)?.name||'Team'} · {n.award}</h3><p className="mt-2 whitespace-pre-wrap break-words">{n.reason}</p>{n.whereWhen&&<p className="mt-2">{n.whereWhen}</p>}<p className="mt-3 text-sm">{n.byFullName||n.by||'Event volunteer'} · {new Date(n.createdAt).toLocaleString()}</p></article>)}
 </section>;
}

export default function JudgingConnector({service=api,loadWorkspace=loadJudgingWorkspace,subscribe=subscribeJudgingWorkspace}) {
 const [authorized,setAuthorized]=useState(false),[code,setCode]=useState(''),[signingIn,setSigningIn]=useState(false);
 const signIn=async e=>{e.preventDefault();setSigningIn(true);setError('');try{const access=await service.claimEventAccess(eventId,code);if(access.serverRole!=='admin')throw Error('An event admin code is required for Judge Advisor setup.');setAuthorized(true);}catch(e){setError(e.message);}finally{setCode('');setSigningIn(false);}};
 const [events,setEvents]=useState([]),[eventId,setEventId]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[tab,setTab]=useState('setup'),[session,setSession]=useState(''),[live,setLive]=useState(false),[last,setLast]=useState(null);
 useEffect(()=>{const listener=service.onAuth?.(session=>{if(!session){setAuthorized(false);setData(null);}});return()=>listener?.data?.subscription?.unsubscribe();},[service]);
 useEffect(()=>{service.listSelectableEvents().then(rows=>setEvents(rows.filter(e=>!e.archivedAt))).catch(e=>setError(e.message));},[service]);
 useEffect(()=>{
  if(!eventId||!authorized){setData(null);return;}
  let active=true,inFlight=false,again=false;
  const refresh=async()=>{if(inFlight){again=true;return;}inFlight=true;try{const next=await loadWorkspace(eventId);if(active){setData(next);setError('');setLast(Date.now());}}catch(e){if(active)setError(e.message);}finally{inFlight=false;if(again&&active){again=false;void refresh();}}};
  setBusy(true);refresh().finally(()=>{if(active)setBusy(false);});
  const off=subscribe(eventId,payload=>{void refresh();if(payload.table==='judging_interview_schedules')window.dispatchEvent(new CustomEvent('refos:judging-change',{detail:{eventId}}));},status=>{if(active)setLive(status==='SUBSCRIBED');});
  const poll=setInterval(refresh,15000),focus=()=>void refresh();window.addEventListener('online',focus);window.addEventListener('focus',focus);
  return()=>{active=false;clearInterval(poll);off();window.removeEventListener('online',focus);window.removeEventListener('focus',focus);};
 },[eventId,authorized,loadWorkspace,subscribe]);
 const changeEvent=id=>{if(authorized&&!confirm('Change event? Save any interview changes first.'))return;setEventId(id);setAuthorized(false);setData(null);setSession('');setTab('setup');setError('');};
 const zone=data?.settings.find(s=>s.key==='event_timezone')?.value?.zone||'UTC';
 const times=(data?.settings||[]).filter(s=>s.key.includes('tm_match_times')&&(!session||s.key.endsWith('@'+session))).flatMap(s=>s.value?.rows||[]);
 return <main className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100"><header className="border-b bg-white p-5 dark:bg-slate-900"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4"><img src="/refos-logo.svg" alt="" className="h-14 w-14"/><div className="flex-1"><h1 className="text-2xl font-bold">Ref-OS Judging Portal</h1><p>Judge Advisor setup · Interviews · Judge groups · Nominations</p></div>{authorized&&<button className="min-h-[44px] rounded border px-4" disabled={busy} onClick={()=>{if(confirm('Sign out? Save any interview changes first.'))service.signOutDeveloperSession().then(()=>{setAuthorized(false);setData(null);}).catch(e=>setError(e.message));}}>Sign out</button>}</div></header>
  <div className="mx-auto max-w-7xl space-y-5 p-5">
  <p className="rounded-xl border border-indigo-300 p-3">Sign in with this event's admin code for Judge Advisor setup. Judges sign in separately on the Ref-OS main page.</p>
  {error&&<p role="alert" className="rounded border border-red-400 p-3">{error}{data&&' Displayed information may be out of date.'}</p>}
  <label className="block font-semibold">Judging event<select disabled={signingIn} value={eventId} onChange={e=>changeEvent(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-xl border bg-transparent p-3"><option value="">Choose an event</option>{events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
  {!authorized?<form onSubmit={signIn} className="space-y-3"><h2 className="text-xl font-bold">Judge Advisor sign-in</h2><label className="block">Event admin code<input type="password" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} className="mt-1 min-h-[44px] w-full rounded border bg-transparent p-3"/></label><button disabled={!eventId||!code.trim()||signingIn} className="min-h-[44px] rounded border px-4">{signingIn?'Checking access...':'Open judging workspace'}</button></form>:<>
   {busy&&<p role="status">Opening judging workspace…</p>}
   {data&&<><p role="status" className="text-sm">{live?'Live connection':'Automatic refresh'} · Last received {last?new Date(last).toLocaleTimeString():'—'}</p>
    <nav aria-label="Judging portal navigation" className="flex flex-wrap gap-2">{[['setup','JA setup & interviews'],['nominations','Nominations']].map(([key,label])=><button key={key} aria-current={tab===key?'page':undefined} onClick={()=>{setTab(key);window.scrollTo({top:0,behavior:'instant'});}} className="min-h-[44px] rounded-xl border px-4 aria-[current=page]:bg-indigo-700 aria-[current=page]:text-white">{label}</button>)}</nav>
    <div hidden={tab!=='setup'}>{data.event.format==='league'&&<label className="mb-4 block">League session<select value={session} onChange={e=>{if(confirm('Change session? Save interview changes first.'))setSession(e.target.value);}} className="ml-3 min-h-[44px] rounded border bg-transparent p-2"><option value="">Event-wide interviews</option>{data.sessions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
     <JudgingInterviews key={eventId+':'+session} developerPreview canManage eventId={eventId} eventName={data.event.name} sessionId={session||null} sessionName={data.sessions.find(s=>s.id===session)?.name||''} teams={data.teams} matches={times} eventTimezone={zone}/>
    </div>
    {tab==='nominations'&&<Nominations rows={data.nominations} teams={data.teams}/>}</>}
  </>}
  </div>
 </main>;
}
