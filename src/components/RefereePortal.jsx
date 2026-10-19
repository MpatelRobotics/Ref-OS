import RefereeProfileForm from "./RefereeProfileForm";
import RefereeCommunityMap from "./RefereeCommunityMap";
import RefereePortalFeedback from "./RefereePortalFeedback";
import RefereePasscode from "./RefereePasscode";
import RefereeEventSearch from "./RefereeEventSearch";
import React,{useEffect,useState} from 'react';
import {supabase} from '../supabaseClient';
import * as api from '../api';
import {accountUser,loadRefereeProfile,saveRefereeProfile,saveEventPlan,hasRefereePasscode,externalEventPlans,refereeEventCatalog,claimRefereePasscode} from '../refereePortalApi';
const empty={full_name:'',country:'',region:'',city:'',phone:'',contact_email:'',discord:'',map_visible:true,map_name:''};
const field='mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white';
const button='min-h-[44px] rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50';
export default function RefereePortal({onClose,eventId,onUnlock,onOpenEvent}){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[mode,setMode]=useState('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[profile,setProfile]=useState(empty),[events,setEvents]=useState([]),[plans,setPlans]=useState([]),[search,setSearch]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[personalEnabled,setPersonalEnabled]=useState(false),[external,setExternal]=useState([]),[section,setSection]=useState('profile'),[showFeedback,setShowFeedback]=useState(false),[mapRefresh,setMapRefresh]=useState(0),[eventFilter,setEventFilter]=useState('all'),[recovery,setRecovery]=useState(()=>new URLSearchParams(window.location.search).get('refPortal')==='recovery');
 async function load(){setLoading(true);try{const current=await accountUser();setUser(current);if(current){const [saved,choices,enabled,outside,catalog]=await Promise.all([loadRefereeProfile(current.id),api.listSelectableEvents(),hasRefereePasscode(),externalEventPlans(current.id),refereeEventCatalog()]);setPersonalEnabled(enabled);setExternal(outside);setProfile({...empty,...Object.fromEntries(Object.keys(empty).map(key=>[key,saved.profile?.[key]??empty[key]]))});setPlans(saved.plans);setEvents(choices.map(event=>({...event,...catalog.find(item=>item.event_id===event.id)})));}}catch(e){setError(e.message);}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 async function run(action){setBusy(true);setError('');setNotice('');try{await action();}catch(e){setError(e.message||'Please try again.');}finally{setBusy(false);}}
 async function authenticate(e){e.preventDefault();await run(async()=>{
  if(mode==='reset'){const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/?refPortal=recovery'});if(error)throw error;setNotice('If this email has an account, a password reset link will arrive shortly.');return;}
  if(mode==='signup'){
   const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+'/?refPortal=1'}});if(error)throw error;
   if(!data.session){setNotice('Check your email to confirm your account, then return here to sign in.');return;}
  }else{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;}
  setPassword('');await load();
 });}
 function openEvent(id){if(onOpenEvent){onOpenEvent(id);return;}const url=new URL(window.location.href);url.searchParams.delete('refPortal');url.searchParams.set('event',id);window.location.assign(url.toString());}
 async function openSelectedEvent(id){await run(async()=>{await claimRefereePasscode(id);openEvent(id);});}
 async function enterEvent(){await run(async()=>{
  let check=await api.verifyEventSession(eventId);
  if(check.status==='archived')throw Error('This event is archived.');
  let access=check.status==='valid'?check:null;
  if(!access){await claimRefereePasscode(eventId);const verified=await api.verifyEventSession(eventId);access=verified.status==='valid'?verified:null;}
  if(!access)throw Error('Event access could not be confirmed.');
  onUnlock(access.role==='admin'?'ref':access.role,access.role==='admin',access.role,'',access.developer===true);
 });}
 return <div className="refos-safe-page fixed inset-0 z-[90] overflow-y-auto bg-slate-100 p-4 text-slate-900 dark:bg-slate-900 dark:text-white"><main className="mx-auto max-w-3xl space-y-5 pb-8">
 <div className="flex flex-wrap items-center justify-between gap-3"><button className={button} disabled={busy} onClick={onClose}>Back to events</button>{user&&<button className={button} disabled={busy} onClick={()=>setShowFeedback(true)}>Send feedback</button>}</div>
 <header><h1 className="text-2xl font-bold">Referee portal</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Your profile, contact details and event history in one place.</p></header>
 {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}{notice&&<p role="status" className="rounded-xl border border-blue-300 bg-blue-50 p-3 text-blue-900">{notice}</p>}
 {loading?<p role="status">Loading your account…</p>:!user?<section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-800">
 <h2 className="text-lg font-bold">{mode==='signup'?'Create a referee account':mode==='reset'?'Reset your password':'Sign in to your account'}</h2>
 <form onSubmit={authenticate} className="mt-4 space-y-4"><label className="block">Email<input className={field} type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
 {mode!=='reset'&&<label className="block">Password<input aria-label="Password" className={field} type="password" autoComplete={mode==='signup'?'new-password':'current-password'} required minLength={mode==='signup'?8:1} value={password} onChange={e=>setPassword(e.target.value)}/>{mode==='signup'&&<p className="mt-1 text-sm text-slate-500">Use at least 8 characters.</p>}</label>}
 <button disabled={busy} className={button+' w-full bg-indigo-700 text-white'}>{busy?'Please wait…':mode==='signup'?'Create account':mode==='reset'?'Send reset link':'Sign in'}</button></form>
 <div className="mt-3 flex flex-wrap gap-2">{[['login','Sign in'],['signup','Create account'],['reset','Forgot password?']].filter(([key])=>key!==mode).map(([key,label])=><button key={key} disabled={busy} className={button} onClick={()=>{setMode(key);setError('');setNotice('');}}>{label}</button>)}</div>
 </section>:<>
 <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><p className="mb-3 font-semibold">Welcome{profile.full_name?`, ${profile.full_name}`:''}</p><label className="block text-sm font-semibold">Portal section<select aria-label="Portal section" className={field} value={section} onChange={e=>setSection(e.target.value)}><option value="profile">My profile &amp; passcode</option><option value="events">My events &amp; event search</option><option value="community">USA referee map</option></select></label></div>
 {recovery&&<form className="space-y-3 rounded-2xl bg-white p-5 dark:bg-slate-800" onSubmit={e=>{e.preventDefault();run(async()=>{const {error}=await supabase.auth.updateUser({password});if(error)throw error;setPassword('');setRecovery(false);setNotice('Password updated.');});}}><h2 className="text-lg font-bold">Set a new password</h2><label className="block">New password<input type="password" autoComplete="new-password" className={field} required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></label><button className={button} disabled={busy}>Update password</button></form>}
 {section==='profile'&&<>
 <RefereeProfileForm profile={profile} setProfile={setProfile} busy={busy} email={user.email} onSave={()=>run(async()=>{await saveRefereeProfile(user.id,profile);setMapRefresh(n=>n+1);setNotice('Profile saved.');})}/>
 <details className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><summary className="min-h-[44px] cursor-pointer font-semibold">Personal referee passcode · {personalEnabled?'Enabled':'Not set'}</summary><RefereePasscode enabled={personalEnabled} busy={busy} run={run} onChange={enabled=>{setPersonalEnabled(enabled);setNotice(enabled?'Personal passcode saved.':'Personal passcode disabled.');}}/></details>
 </>}
 {section==='community'&&<RefereeCommunityMap refresh={mapRefresh}/>}
 {section==='events'&&<>
 {eventId&&<section className="space-y-3 rounded-2xl bg-white p-5 dark:bg-slate-800"><h2 className="text-lg font-bold">Open this event</h2><p className="text-sm">Mark this event attended or going in My events below, then continue. No event Admin code is needed.</p><button className={button+' bg-indigo-700 text-white'} disabled={busy} onClick={enterEvent}>Continue to event</button></section>}
 <RefereeEventSearch user={user} external={external} setExternal={setExternal} run={run} busy={busy} onOpen={openEvent}/>

 <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-800"><h2 className="text-lg font-bold">My events</h2><p className="text-sm text-slate-500">Select events you attended or plan to attend to enable your personal Referee access. No event Admin code is required. Attendance is self-reported.</p>
 <div className="grid gap-4 sm:grid-cols-2">{[['attended','Events I attended'],['going','Events I’m going to']].map(([value,label])=><div key={value}><h3 className="font-semibold">{label}</h3><ul className="mt-2 space-y-2">{plans.filter(p=>p.attendance===value).map(p=><li key={p.event_id}>{events.find(e=>e.id===p.event_id)?.name||'Unavailable event'} <button className={button} disabled={busy||!!events.find(e=>e.id===p.event_id)?.archivedAt} onClick={()=>openSelectedEvent(p.event_id)}>Open event</button></li>)}</ul>{!plans.some(p=>p.attendance===value)&&<p className="mt-2 text-sm text-slate-500">No events selected yet.</p>}</div>)}</div>
 <label className="block">Show Ref OS events<select aria-label="Show Ref OS events" className={field} value={eventFilter} onChange={e=>setEventFilter(e.target.value)}><option value="all">All events</option><option value="going">I’m going</option><option value="attended">I attended</option><option value="unselected">Not selected yet</option><option value="active">Active events</option></select></label>
 <label className="block">Find an event<input type="search" className={field} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search Ref OS events by name, location or RE-/VE- code"/></label>
 <div className="max-h-96 space-y-3 overflow-y-auto">{events.filter(e=>eventFilter==='all'||eventFilter==='active'&&!e.archivedAt||eventFilter==='unselected'&&!plans.some(p=>p.event_id===e.id)||plans.some(p=>p.event_id===e.id&&p.attendance===eventFilter)).filter(e=>[e.name,e.code,e.location].some(value=>String(value||'').toLowerCase().includes(search.toLowerCase()))).map(event=><label key={event.id} className="block rounded-xl border border-slate-200 p-3 dark:border-slate-600"><span className="font-semibold">{event.name}</span><span className="block text-sm">{event.code} {event.location}</span>{event.archivedAt&&<span className="ml-2 text-sm text-slate-500">Archived</span>}<select aria-label={'Attendance for '+event.name} className={field} disabled={busy} value={plans.find(p=>p.event_id===event.id)?.attendance||''} onChange={e=>{const attendance=e.target.value;run(async()=>{await saveEventPlan(user.id,event.id,attendance);setPlans(old=>[...old.filter(p=>p.event_id!==event.id),...(attendance?[{event_id:event.id,attendance}]:[])]);setNotice('Event selection saved.');});}}><option value="">Not selected</option><option value="attended">I attended</option><option value="going">I’m going</option></select></label>)}</div></section>
 </>}
 {showFeedback&&<RefereePortalFeedback onClose={()=>setShowFeedback(false)}/>}
 <button className={button} disabled={busy} onClick={()=>run(async()=>{const {error}=await supabase.auth.signOut();if(error)throw error;setUser(null);setProfile(empty);setPlans([]);setPassword('');})}>Sign out of account</button>
 </>}
 </main></div>;
}
