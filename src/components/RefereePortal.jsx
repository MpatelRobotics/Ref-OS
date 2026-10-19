import React,{useEffect,useState} from 'react';
import {supabase} from '../supabaseClient';
import * as api from '../api';
import {accountUser,loadRefereeProfile,saveRefereeProfile,saveEventPlan} from '../refereePortalApi';
const regionNames = new Intl.DisplayNames(['en'], {type:'region'});
const countries = Array.from({length:676},(_,i)=>String.fromCharCode(65+Math.floor(i/26),65+i%26)).map(code=>regionNames.of(code)).filter((name,i,all)=>name && !/^[A-Z]{2}$/.test(name) && all.indexOf(name)===i).sort();
const empty={full_name:'',country:'',region:'',city:'',phone:'',contact_email:'',discord:''};
const field='mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white';
const button='min-h-[44px] rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50';
export default function RefereePortal({onClose,eventId,onUnlock}){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[mode,setMode]=useState('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[profile,setProfile]=useState(empty),[events,setEvents]=useState([]),[plans,setPlans]=useState([]),[search,setSearch]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[code,setCode]=useState(''),[recovery,setRecovery]=useState(()=>new URLSearchParams(window.location.search).get('refPortal')==='recovery');
 async function load(){setLoading(true);try{const current=await accountUser();setUser(current);if(current){const [saved,choices]=await Promise.all([loadRefereeProfile(current.id),api.listSelectableEvents()]);setProfile({...empty,...Object.fromEntries(Object.keys(empty).map(key=>[key,saved.profile?.[key]||'']))});setPlans(saved.plans);setEvents(choices);}}catch(e){setError(e.message);}finally{setLoading(false);}}
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
 async function enterEvent(){await run(async()=>{
  let check=await api.verifyEventSession(eventId);
  if(check.status==='archived')throw Error('This event is archived.');
  let access=check.status==='valid'?check:null;
  if(!access){if(!code.trim())throw Error('Enter the event access code provided by event leadership to join this crew.');await api.claimEventAccess(eventId,code);const verified=await api.verifyEventSession(eventId);access=verified.status==='valid'?verified:null;}
  if(!access)throw Error('Event access could not be confirmed.');
  onUnlock(access.role==='admin'?'ref':access.role,access.role==='admin',access.role,'',access.developer===true);
 });}
 return <div className="refos-safe-page fixed inset-0 z-[90] overflow-y-auto bg-slate-100 p-4 text-slate-900 dark:bg-slate-900 dark:text-white"><main className="mx-auto max-w-2xl space-y-5 pb-8">
 <button className={button} disabled={busy} onClick={onClose}>Back to events</button>
 <header><h1 className="text-2xl font-bold">Referee portal</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Your profile, contact details and event history in one place.</p></header>
 {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}{notice&&<p role="status" className="rounded-xl border border-blue-300 bg-blue-50 p-3 text-blue-900">{notice}</p>}
 {loading?<p role="status">Loading your account…</p>:!user?<section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-800">
 <h2 className="text-lg font-bold">{mode==='signup'?'Create a referee account':mode==='reset'?'Reset your password':'Sign in to your account'}</h2>
 <form onSubmit={authenticate} className="mt-4 space-y-4"><label className="block">Email<input className={field} type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
 {mode!=='reset'&&<label className="block">Password<input aria-label="Password" className={field} type="password" autoComplete={mode==='signup'?'new-password':'current-password'} required minLength={mode==='signup'?8:1} value={password} onChange={e=>setPassword(e.target.value)}/>{mode==='signup'&&<p className="mt-1 text-sm text-slate-500">Use at least 8 characters.</p>}</label>}
 <button disabled={busy} className={button+' w-full bg-indigo-700 text-white'}>{busy?'Please wait…':mode==='signup'?'Create account':mode==='reset'?'Send reset link':'Sign in'}</button></form>
 <div className="mt-3 flex flex-wrap gap-2">{[['login','Sign in'],['signup','Create account'],['reset','Forgot password?']].filter(([key])=>key!==mode).map(([key,label])=><button key={key} disabled={busy} className={button} onClick={()=>{setMode(key);setError('');setNotice('');}}>{label}</button>)}</div>
 </section>:<>
 {recovery&&<form className="space-y-3 rounded-2xl bg-white p-5 dark:bg-slate-800" onSubmit={e=>{e.preventDefault();run(async()=>{const {error}=await supabase.auth.updateUser({password});if(error)throw error;setPassword('');setRecovery(false);setNotice('Password updated.');});}}><h2 className="text-lg font-bold">Set a new password</h2><label className="block">New password<input type="password" autoComplete="new-password" className={field} required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></label><button className={button} disabled={busy}>Update password</button></form>}
 <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-800"><h2 className="text-lg font-bold">My profile</h2><p className="text-sm text-slate-500">Signed in as {user.email}. Your contact details and event plans are private to your account.</p>
 <form className="space-y-4" onSubmit={e=>{e.preventDefault();run(async()=>{await saveRefereeProfile(user.id,profile);setNotice('Profile saved.');});}}>
 <div className="grid gap-4 sm:grid-cols-2">{[['full_name','Full name',100],['country','Country',100],['region','State / province / region',100],['city','City',100],['phone','Phone',50],['contact_email','Contact email',254],['discord','Discord username',100]].map(([key,label,max])=><label key={key} className="block">{label}<input list={key==='country'?'referee-countries':undefined} className={field} required={key==='full_name'} type={key==='contact_email'?'email':key==='phone'?'tel':'text'} maxLength={max} value={profile[key]} onChange={e=>setProfile(p=>({...p,[key]:e.target.value}))}/></label>)}</div>
 <datalist id="referee-countries">{countries.map(country=><option key={country} value={country}/>)}</datalist>
 <button disabled={busy} className={button+' bg-indigo-700 text-white'}>{busy?'Saving…':'Save profile'}</button></form></section>
 {eventId&&<section className="space-y-3 rounded-2xl bg-white p-5 dark:bg-slate-800"><h2 className="text-lg font-bold">Open this event</h2><p className="text-sm">Your account remembers approved event access. For a new event, enter the crew code supplied by event leadership.</p><label className="block">Event access code (first visit)<input className={field} maxLength={4} autoCapitalize="characters" autoComplete="off" value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/></label><button className={button+' bg-indigo-700 text-white'} disabled={busy} onClick={enterEvent}>Continue to event</button></section>}
 <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-800"><h2 className="text-lg font-bold">My events</h2><p className="text-sm text-slate-500">Mark past attendance or upcoming plans. These selections do not grant crew access or confirm an official assignment.</p>
 <div className="grid gap-4 sm:grid-cols-2">{[['attended','Events I attended'],['going','Events I’m going to']].map(([value,label])=><div key={value}><h3 className="font-semibold">{label}</h3><ul className="mt-2 space-y-2">{plans.filter(p=>p.attendance===value).map(p=><li key={p.event_id}>{events.find(e=>e.id===p.event_id)?.name||'Unavailable event'}</li>)}</ul>{!plans.some(p=>p.attendance===value)&&<p className="mt-2 text-sm text-slate-500">No events selected yet.</p>}</div>)}</div>
 <label className="block">Find an event<input type="search" className={field} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search events by name"/></label>
 <div className="max-h-96 space-y-3 overflow-y-auto">{events.filter(e=>e.name.toLowerCase().includes(search.toLowerCase())).map(event=><label key={event.id} className="block rounded-xl border border-slate-200 p-3 dark:border-slate-600"><span className="font-semibold">{event.name}</span>{event.archivedAt&&<span className="ml-2 text-sm text-slate-500">Archived</span>}<select aria-label={'Attendance for '+event.name} className={field} disabled={busy} value={plans.find(p=>p.event_id===event.id)?.attendance||''} onChange={e=>{const attendance=e.target.value;run(async()=>{await saveEventPlan(user.id,event.id,attendance);setPlans(old=>[...old.filter(p=>p.event_id!==event.id),...(attendance?[{event_id:event.id,attendance}]:[])]);setNotice('Event selection saved.');});}}><option value="">Not selected</option><option value="attended">I attended</option><option value="going">I’m going</option></select></label>)}</div></section>
 <button className={button} disabled={busy} onClick={()=>run(async()=>{const {error}=await supabase.auth.signOut();if(error)throw error;setUser(null);setProfile(empty);setPlans([]);setPassword('');})}>Sign out of account</button>
 </>}
 </main></div>;
}
