import React, {useEffect,useMemo,useRef,useState} from 'react';
import {listLostFound,saveLostFound,setLostFoundReturned,prepareItemPhoto,lostFoundPhoto} from '../lostFound';

function ItemPhoto({path}) {
  const [url,setUrl]=useState(''); const [failed,setFailed]=useState(false); const [retry,setRetry]=useState(0);
  useEffect(()=>{let live=true;setUrl('');setFailed(false);lostFoundPhoto(path).then(value=>{if(live)setUrl(value);}).catch(()=>{if(live)setFailed(true);});return()=>{live=false;};},[path,retry]);
  if(failed)return <button type="button" onClick={()=>setRetry(n=>n+1)} className="min-h-[44px] rounded-lg border p-3">Picture unavailable · Retry</button>;
  if(!url)return <p role="status">Loading picture…</p>;
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Found item" onError={()=>setFailed(true)} className="max-h-64 max-w-full rounded-lg object-contain"/></a>;
}

const defaultService={listLostFound,saveLostFound,setLostFoundReturned,prepareItemPhoto};
export default function LostFoundBoard({eventId,eventName,meName,canManage,onClose,service=defaultService}) {
  const [items,setItems]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [description,setDescription]=useState(''),[location,setLocation]=useState(''),[photo,setPhoto]=useState(null),[processing,setProcessing]=useState(false),[attempted,setAttempted]=useState(false);
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('available');
  const id=useRef(crypto.randomUUID()); const flight=useRef(false);
  const refresh=async()=>{try{const rows=await service.listLostFound(eventId);setItems(rows);setError('');}catch(e){setError(e.message);}finally{setLoading(false);}};
  useEffect(()=>{let live=true;const load=async()=>{try{const rows=await service.listLostFound(eventId);if(live){setItems(rows);setError('');}}catch(e){if(live)setError(e.message);}finally{if(live)setLoading(false);}};load();const timer=setInterval(()=>{if(document.visibilityState==='visible')load();},30000);return()=>{live=false;clearInterval(timer);};},[eventId,service]);
  const shown=useMemo(()=>items.filter(item=>(filter==='all'||item.returned===(filter==='returned'))&&`${item.description} ${item.pickup_location}`.toLowerCase().includes(query.toLowerCase())),[items,filter,query]);
  const pick=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file||flight.current||processing)return;setProcessing(true);setError('');try{setPhoto(await service.prepareItemPhoto(file));}catch(e){setError(e.message);}finally{setProcessing(false);}};
  const submit=async e=>{e.preventDefault();if(flight.current||processing)return;flight.current=true;setBusy(true);setAttempted(true);setError('');try{await service.saveLostFound({eventId,id:id.current,description,location,by:meName,photo});setDescription('');setLocation('');setPhoto(null);setAttempted(false);id.current=crypto.randomUUID();await refresh();}catch(e){setError(e.message);}finally{flight.current=false;setBusy(false);}};
  const toggle=async item=>{if(flight.current)return;flight.current=true;setBusy(true);try{await service.setLostFoundReturned(item.id,!item.returned);await refresh();}catch(e){setError(e.message);}finally{flight.current=false;setBusy(false);}};
  return <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
    <header className="shrink-0 flex items-center gap-3 border-b bg-white p-3 dark:bg-slate-800"><button type="button" onClick={onClose} className="refos-back-button">Back</button><h2 className="font-bold">Lost &amp; Found · {eventName}</h2></header>
    <main className="flex-1 overflow-y-auto"><div className="mx-auto max-w-2xl space-y-5 p-4 pb-12">
      <p>Record found items and where owners can collect them. Avoid posting personal information or photographs of people. This board is shared across the event, including League sessions.</p>
      {error&&<p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      <form onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-4 dark:bg-slate-800">
        <h3 className="font-bold">Add a found item</h3>
        <label className="block">Item description<textarea required maxLength={1000} disabled={busy||attempted} value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 w-full rounded-lg border bg-transparent p-3"/></label>
        <label className="block">Pickup location<input required maxLength={200} disabled={busy||attempted} value={location} onChange={e=>setLocation(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-lg border bg-transparent p-3"/></label>
        <label className="block">Item photo (optional)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||processing||attempted} onChange={pick} className="block min-h-[44px] max-w-full py-2"/></label>
        <p className="text-sm">JPEG, PNG, or WebP, up to 10 MB. Adding items requires an internet connection.</p>
        {processing&&<p role="status">Preparing picture…</p>}
        {photo&&<div><img src={photo.preview} alt="Selected found item" className="max-h-40 rounded-lg"/><button type="button" disabled={busy||attempted} onClick={()=>setPhoto(null)} className="min-h-[44px] border rounded-lg px-3">Remove photo</button></div>}
        <button disabled={busy||processing||!description.trim()||!location.trim()} className="min-h-[44px] rounded-lg bg-sky-800 px-4 text-white">{busy?'Saving…':attempted?'Retry saving item':'Add item'}</button>
      </form>
      <div className="flex flex-wrap gap-3"><label className="flex-1">Search items<input value={query} onChange={e=>setQuery(e.target.value)} className="block min-h-[44px] w-full rounded-lg border bg-transparent p-2"/></label><label>Show<select aria-label="Show" value={filter} onChange={e=>setFilter(e.target.value)} className="block min-h-[44px] rounded-lg border bg-transparent p-2"><option value="available">Awaiting pickup</option><option value="returned">Returned</option><option value="all">All items</option></select></label><button type="button" disabled={busy} onClick={refresh} className="min-h-[44px] self-end rounded-lg border px-3">Refresh</button></div>
      {loading?<p role="status">Loading items…</p>:shown.length===0?<p>No items match this view.</p>:shown.map(item=><article key={item.id} className="space-y-2 rounded-xl border bg-white p-4 dark:bg-slate-800"><span className="text-sm font-bold">{item.returned?'Returned':'Awaiting pickup'}</span><p className="whitespace-pre-wrap break-words">{item.description}</p><p className="break-words"><b>Pickup:</b> {item.pickup_location}</p>{item.photo_path&&<ItemPhoto path={item.photo_path}/>}<p className="text-sm">Added {new Date(item.created_at).toLocaleString()} {item.logged_by&&`by ${item.logged_by}`}</p>{canManage&&<button type="button" disabled={busy} onClick={()=>toggle(item)} className="min-h-[44px] rounded-lg border px-3">{item.returned?'Reopen item':'Mark returned'}</button>}</article>)}
    </div></main>
  </div>;
}
