export async function saveDetectedEventTimezone({api,eventId,details,by,current=()=>true}) {
 const zone=details?.timezone;
 if(typeof zone!=='string'||zone.length>100||!current())return null;
 try{new Intl.DateTimeFormat('en',{timeZone:zone});}catch{return null;}
 const previous=await api.getEventSetting(eventId,'event_timezone');
 if(!current())return null;
 // A manually saved zone always wins. Only a prior automatic zone may follow
 // an explicitly changed event code to a different venue.
 if(previous?.value?.zone&&(previous.value.source!=='VEX event lookup'||previous.value.code===details.code))return previous;
 return api.upsertEventSetting(eventId,'event_timezone',{zone,source:'VEX event lookup',code:details.code,detectedFrom:details.timezoneSource},by);
}
