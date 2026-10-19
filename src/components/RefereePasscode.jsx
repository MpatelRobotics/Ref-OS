import React,{useState} from 'react';
import {setRefereePasscode} from '../refereePortalApi';
export default function RefereePasscode({enabled,busy,run,onChange}){
 const [code,setCode]=useState(''),[confirm,setConfirm]=useState('');
 return <section className="space-y-3 rounded-2xl bg-white p-5 dark:bg-slate-800"><h2 className="text-lg font-bold">My referee passcode</h2><p className="text-sm">{enabled?'Your passcode is enabled.':'Create a passcode to use on event login screens.'} It grants Referee access to events you mark attended or going. It does not grant Admin access. Letters are not case sensitive.</p>
 <form className="space-y-3" onSubmit={e=>{e.preventDefault();run(async()=>{if(code!==confirm)throw Error('Passcodes do not match.');await setRefereePasscode(code);setCode('');setConfirm('');onChange(true);});}}>
 <label className="block">New referee passcode<input type="password" autoComplete="new-password" required pattern="(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{8,16}" minLength={8} maxLength={16} value={code} onChange={e=>setCode(e.target.value)} className="mt-1 w-full rounded-xl border bg-transparent px-3 py-3"/></label><p className="text-sm text-slate-500">Use 8–16 letters and numbers, with at least one of each. Choose a different code from your account password.</p>
 <label className="block">Confirm referee passcode<input type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-1 w-full rounded-xl border bg-transparent px-3 py-3"/></label>
 <button disabled={busy} className="min-h-[44px] rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Save referee passcode</button></form>
 {enabled&&<button disabled={busy} onClick={()=>run(async()=>{await setRefereePasscode('');onChange(false);})} className="min-h-[44px] rounded-xl border px-4 py-2">Disable personal passcode</button>}
 </section>;
}
