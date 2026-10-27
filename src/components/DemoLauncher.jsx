import React,{useState} from 'react';
import {DEMO_EVENTS} from '../demoEvents.js';
export default function DemoLauncher({onChoose}){
 const [open,setOpen]=useState(false),[code,setCode]=useState(''),[accepted,setAccepted]=useState(false),[error,setError]=useState('');
 return <section className="my-4 rounded-2xl border border-indigo-300 bg-indigo-50 p-4 dark:border-indigo-700 dark:bg-indigo-950/30">
 {!open?<><button type="button" className="min-h-[48px] w-full rounded-xl bg-indigo-700 px-4 py-3 font-semibold text-white hover:bg-indigo-800" onClick={()=>setOpen(true)}>Try the DEMO</button><p className="mt-2 text-center text-sm">Explore Ref OS with fictional teams. Demo login: <b>VTOW</b></p></>:<>
 <div className="flex items-center justify-between gap-2"><h2 className="font-bold">Try Ref OS</h2><button type="button" className="min-h-[44px] rounded-lg border px-3" onClick={()=>{setOpen(false);setAccepted(false);setCode('');setError('');}}>Cancel</button></div>
 {!accepted?<form className="mt-3 space-y-3" onSubmit={e=>{e.preventDefault();if(code.trim().toUpperCase()!=='VTOW'){setError('Enter VTOW to try the demo.');return;}setAccepted(true);setError('');}}>
 <label className="block font-medium">Demo code<input className="mt-1 min-h-[48px] w-full rounded-lg border bg-white p-3 text-slate-900 dark:bg-slate-900 dark:text-white" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={4}/></label>
 {error&&<p role="alert">{error}</p>}<button className="min-h-[48px] w-full rounded-xl bg-indigo-700 p-3 font-semibold text-white">Continue</button></form>:<><p className="my-3">Which program would you like to explore?</p><div className="grid gap-3 sm:grid-cols-2">{[['v5','V5 · Override'],['iq','VEX IQ · Level Up']].map(([program,label])=><button key={program} type="button" className="min-h-[56px] rounded-xl bg-indigo-700 p-4 font-semibold text-white hover:bg-indigo-800" onClick={()=>{sessionStorage.setItem('refosDemoEntry',JSON.stringify({eventId:DEMO_EVENTS[program],code:'VTOW'}));onChoose(DEMO_EVENTS[program]);}}>{label}</button>)}</div><p className="mt-3 text-sm">Each program has 32 fictional teams and its own rules. These are shared demo events: other visitors can see your changes. Use fictional names and sample information.</p></>}
 </>}
 </section>;
}
