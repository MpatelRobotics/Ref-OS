import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
export default function IQManual(){
 const [open,setOpen]=useState(false),back=useRef(null),opener=useRef(null);
 useEffect(()=>{
  if(!open)return;
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';back.current?.focus();
  const escape=e=>{if(e.key==='Escape')setOpen(false);};window.addEventListener('keydown',escape);
  return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',escape);opener.current?.focus();};
 },[open]);
 const show=e=>{opener.current=e.currentTarget;setOpen(true);};
 return <section aria-label="VEX IQ manual" className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
 <h2 className="font-bold text-lg">VEX IQ · Level Up</h2><p className="text-sm">2026–2027 Game Manual · Version 2.0 · September 3, 2026</p>
 <p className="text-sm text-slate-500">This is the manual supplied by the event organizer. Check official VEX resources for later updates. Use Matches for partner teamwork and shared scores, Finals for ranked partnerships, and Rankings for imported qualification averages and skills. Tournament Manager records official results and resolves tiebreakers.</p>
 <div className="flex flex-wrap gap-2"><button type="button" onClick={show} className="min-h-[44px] border rounded-lg px-3 py-2">Read IQ manual</button><button type="button" onClick={show} className="min-h-[44px] border rounded-lg px-3 py-2">Open PDF</button><a href="/manuals/levelup-2.0.pdf" download className="min-h-[44px] border rounded-lg px-3 py-2">Download manual</a></div>
 <p className="text-sm text-slate-500">The manual is saved for offline access when the updated app finishes downloading its offline files. Read IQ manual and Open PDF keep you inside Ref OS with a Back button.</p>
 {open&&createPortal(<div role="dialog" aria-modal="true" aria-label="IQ game manual" className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-slate-900" style={{height:'100dvh',paddingTop:'env(safe-area-inset-top)',paddingBottom:'env(safe-area-inset-bottom)'}}>
 <header className="shrink-0 flex flex-wrap items-center gap-3 border-b border-slate-200 dark:border-slate-700 p-3"><button ref={back} type="button" onClick={()=>setOpen(false)} className="min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 font-semibold">← Back to Ref OS</button><span className="font-semibold text-sm">IQ Level Up · Manual v2.0</span></header>
 <iframe title="VEX IQ Level Up game manual version 2.0" src="/manuals/levelup-2.0.pdf" className="w-full flex-1 min-h-0 border-0" style={{height:'100%'}}/>
 </div>,document.body)}
 </section>;
}
