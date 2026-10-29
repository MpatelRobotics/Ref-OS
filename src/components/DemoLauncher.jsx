import React,{useState,useEffect} from 'react';
import {DEMO_EVENTS} from '../demoEvents.js';
export default function DemoLauncher({onChoose,openRequest=0}){
 const [open,setOpen]=useState(false),[code,setCode]=useState(''),[error,setError]=useState('');
 useEffect(()=>{if(openRequest)setOpen(true);},[openRequest]);
 return <section className="text-slate-900 dark:text-slate-100 my-4 rounded-2xl border border-indigo-300 bg-indigo-50 p-4 dark:border-indigo-700 dark:bg-indigo-950/30">
 {!open?<><button type="button" className="min-h-[48px] w-full rounded-xl bg-indigo-700 px-4 py-3 font-semibold text-white hover:bg-indigo-800" onClick={()=>setOpen(true)}>Try the DEMO</button><p className="mt-2 text-center text-sm">Explore V5 Override with 32 fictional teams. Demo login: <b>DEMOV5</b></p></>:<>
 <div className="flex items-center justify-between gap-2"><h2 className="font-bold">Try Ref OS</h2><button type="button" className="min-h-[44px] rounded-lg border px-3" onClick={()=>{setOpen(false);setCode('');setError('');}}>Cancel</button></div>
 <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">Demo passcode: <strong className="font-mono text-base tracking-wide">DEMOV5</strong></p>
 {<form className="mt-3 space-y-3" onSubmit={e=>{e.preventDefault();if(code.trim().toUpperCase()!=='DEMOV5'){setError('Enter DEMOV5 to try the demo.');return;}setError('');sessionStorage.setItem('refosDemoEntry',JSON.stringify({eventId:DEMO_EVENTS.v5,code:'DEMOV5'}));onChoose(DEMO_EVENTS.v5);}}>
 <label className="block font-medium">Demo code<input className="mt-1 min-h-[48px] w-full rounded-lg border bg-white p-3 text-slate-900 dark:bg-slate-900 dark:text-white" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={6}/></label>
 {error&&<p role="alert">{error}</p>}<button className="min-h-[48px] w-full rounded-xl bg-indigo-700 p-3 font-semibold text-white">Continue</button></form>}
 </>}
 </section>;
}
