import {useEffect,useRef} from 'react';
import {reportLiveActivity,removeLiveActivity} from './liveActivity';
export default function useLiveActivity({eventId,sessionId,name,screen,activity}){
 const device=useRef(null);const current=useRef(null);current.current={eventId,sessionId,name,screen,activity};
 useEffect(()=>{
  if(!eventId)return;
  device.current=crypto.randomUUID();const id=device.current;let stopped=false,flight=false;
  const send=async()=>{if(stopped||flight)return;flight=true;const x=current.current;try{await reportLiveActivity(id,x.eventId,x.sessionId,x.name,x.screen,document.hidden?'Background':x.activity,!document.hidden);}catch{/* Activity reporting never interrupts event work. */}finally{flight=false;if(stopped)removeLiveActivity(id).catch(()=>{});}};
  device.send=send;send();const timer=setInterval(send,30000);document.addEventListener('visibilitychange',send);
  return()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',send);removeLiveActivity(id).catch(()=>{});device.send=null;};
 },[eventId,sessionId]);
 useEffect(()=>{device.send?.();},[screen,activity,name]);
}
