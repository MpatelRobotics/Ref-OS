import {useEffect,useRef} from 'react';
import {saveDetectedEventTimezone} from '../detectedEventTimezone.js';
export default function AutoEventTimezone({api,eventId,details,saved,enabled,onSaved,by}) {
 const callback=useRef(onSaved);callback.current=onSaved;
 const code=details?.code;
 useEffect(()=>{
  if(!enabled||!code||saved?.value?.zone&&(saved.value.source!=='VEX event lookup'||saved.value.code===code))return;
  let active=true;
  (async()=>{
   const detected=details?.timezone&&details.timezoneCode===code?details:await api.lookupVexEvent(code);
   if(!active)return;
   const row=await saveDetectedEventTimezone({api,eventId,details:detected,by,current:()=>active});
   if(active&&row)callback.current(row);
  })().catch(()=>{/* Leave the manual selector available if metadata cannot be resolved. */});
  return()=>{active=false;};
 },[api,eventId,code,enabled,saved?.value?.zone,saved?.value?.source,saved?.value?.code]);
 return null;
}
