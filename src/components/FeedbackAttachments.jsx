import React, { useState } from 'react';
import { loadFeedbackScreenshots } from '../feedbackScreenshots';
export default function FeedbackAttachments({feedbackId,loadScreenshots=loadFeedbackScreenshots}) {
 const [images,setImages]=useState(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const load=async()=>{if(busy)return;setBusy(true);setError('');try{setImages(await loadScreenshots(feedbackId));}catch(e){setError(e.message || 'Could not load screenshots.');}finally{setBusy(false);}};
 return <div className="mt-3 space-y-2"><button type="button" disabled={busy} onClick={load} className="min-h-[44px] rounded-lg border px-3 disabled:opacity-50">{busy?'Loading screenshots…':images?'Refresh screenshots':'View screenshots'}</button>{error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}{images?.length===0 && <p className="text-sm">No screenshots attached.</p>}
 {images?.map(image=><figure key={image.slot} className="space-y-1"><a href={image.url} target="_blank" rel="noreferrer" className="block min-h-[44px]"><img src={image.url} alt={`Feedback screenshot ${image.slot+1}`} className="max-h-96 max-w-full rounded-lg border object-contain" onError={()=>setError('Screenshot link expired or could not load. Press Refresh screenshots to try again.')}/></a><figcaption className="text-sm">Screenshot {image.slot+1} · Tap to open full size</figcaption></figure>)}</div>;
}
