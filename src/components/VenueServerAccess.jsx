import React, {useState} from 'react';
import {Server} from 'lucide-react';

export default function VenueServerAccess(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const desktop=Boolean(window.refosTmDesktop?.openVenueServer);
 const open=async()=>{setBusy(true);setError('');try{await window.refosTmDesktop.openVenueServer();}catch(e){setError((e?.message||'Could not open venue controls.')+' If you have an older Connect app, update it in Microsoft Store.');}finally{setBusy(false);}};
 return <section className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
  <h2 className="flex items-center gap-2 text-xl font-bold"><Server size={20}/>Venue Server</h2>
  <p className="mt-2 text-sm">Host local sharing for your event on this computer. Connect your crew’s devices to the same network.</p>
  {desktop?<button type="button" disabled={busy} onClick={open} className="mt-4 min-h-[48px] rounded-lg bg-indigo-700 px-5 py-3 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{busy?'Opening venue controls…':'Manage Venue Server'}</button>:<a href="https://apps.microsoft.com/detail/9PBVDZJLG8SP" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-[48px] items-center rounded-lg bg-indigo-700 px-5 py-3 font-semibold text-white hover:bg-indigo-800">Get Ref-OS Connect from Microsoft Store</a>}
  <p className="mt-3 text-sm">Click Start Server in the controls when you’re ready. Opening the controls does not start hosting or TM sync. You can also access these controls inside an event through Sync &amp; Venue Server.</p>
  {error&&<p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
 </section>;
}
