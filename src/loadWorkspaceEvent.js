import {isDemoEvent} from './demoEvents.js';
export async function loadWorkspaceEvent(api,eventId){
 let firstError;
 try{const event=await api.getEvent(eventId,{strict:true});if(event)return event;}
 catch(error){firstError=error;}
 // The public demo code can restore only the known public demo membership.
 if(isDemoEvent(eventId)){
  await api.claimEventAccess(eventId,'DEMOV5');
  const event=await api.getEvent(eventId,{strict:true});if(event)return event;
 }
 throw firstError||Error('Event access could not be confirmed.');
}
