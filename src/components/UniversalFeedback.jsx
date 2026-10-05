import React, { useCallback, useState } from 'react';
import FeedbackViewer from './FeedbackViewer';
import * as api from '../api';
export default function UniversalFeedback({ events = [], onClose, listFeedback = api.listUniversalFeedback, claimAccess = api.claimEventAccess, saveStatus = api.setUniversalFeedbackStatus }) {
 const [verified,setVerified]=useState(false);
 const [code,setCode]=useState('');
 const [authEvent,setAuthEvent]=useState(events.find(e=>!e.archivedAt)?.id || '');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [entries,setEntries]=useState([]);
 const load=useCallback(async()=>{
   const rows=await listFeedback();setEntries(rows);
   return rows.map(r=>({feedback_id:r.id,status:r.status}));
 },[listFeedback]);
 const signIn=async(e)=>{
   e.preventDefault();if(busy)return;setBusy(true);setError('');
   try {
     const access=await claimAccess(authEvent,code);setCode('');
     if(!access.developer)throw Error('Developer access is required.');
     await load();setVerified(true);
   }catch{setCode('');setError('Could not open universal feedback. Check your Developer code, connection, and that universal-feedback.sql has been run.');}
   finally{setBusy(false);}
 };
 if(verified)return <FeedbackViewer universal isDeveloper entries={entries} onClose={onClose} loadStatuses={load} saveStatus={saveStatus}/>;
 return <section className="space-y-4"><button type="button" onClick={onClose} className="min-h-[44px] font-semibold">Back to Choose VEX Event</button><h2 className="text-xl font-bold">Universal Feedback</h2><p className="text-sm">Sign in as Developer to review feedback from every event and League session, including archived events. The event below is used only to verify your Developer sign-in.</p>
 <form onSubmit={signIn} className="space-y-3"><label className="block">Sign-in event<select value={authEvent} onChange={e=>setAuthEvent(e.target.value)} className="block w-full min-h-[44px] rounded-lg border bg-white dark:bg-slate-800 px-3">{events.filter(e=>!e.archivedAt).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
 <label className="block">Developer code<input type="password" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} className="block w-full min-h-[44px] rounded-lg border bg-white dark:bg-slate-800 px-3"/></label>
 <button type="submit" disabled={busy || !authEvent || !code.trim()} className="min-h-[44px] rounded-lg bg-sky-800 text-white px-4 disabled:opacity-50">{busy?'Checking Developer access…':'Open all feedback'}</button></form>{!authEvent && <p>No active event is available for Developer sign-in.</p>}{error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}</section>;
}
