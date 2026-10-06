import React, {useEffect,useState} from 'react';

export default function EventLocalClock({timeZone}) {
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{
  const refresh=()=>setNow(new Date());
  const timer=setInterval(refresh,15000);
  document.addEventListener('visibilitychange',refresh);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 let label='Event time · timezone not set';
 if(timeZone){
  try {label='Event time · '+new Intl.DateTimeFormat('en-US',{timeZone,hour:'numeric',minute:'2-digit',hour12:true,timeZoneName:'short'}).format(now);}
  catch {label='Event time · check timezone setting';}
 }
 return <div className="mt-1 text-xs text-slate-200" title={timeZone || 'Admin/Developer can choose the event timezone in the interview scheduler.'}><time dateTime={now.toISOString()}>{label}</time></div>;
}
