// Persist server state and rejected work before removing acknowledged local work.
export async function settleVenueBatch({batch,results,pull,preserveRejected,removeAccepted}){
 const replies=new Map((results||[]).map(row=>[row.changeId,row]));
 const allowed=new Set(['applied','applied_conflict','unchanged','duplicate','rejected_deleted','invalid']);
 const accepted=new Set(),rejected=[];
 for(const change of batch){
  const reply=replies.get(change.changeId);
  if(!reply||!allowed.has(reply.status))continue;
  accepted.add(change.changeId);
  if(reply.status==='invalid'||reply.status==='rejected_deleted')rejected.push({change,error:reply.error||(reply.status==='rejected_deleted'?'This record was deleted on the venue server. Review this saved change before recreating it.':'Invalid change'),at:Date.now()});
 }
 if(!accepted.size)throw Error('The venue server did not confirm queued changes. Your changes are still saved on this device.');
 await pull();
 if(rejected.length)await preserveRejected(rejected);
 await removeAccepted(accepted);
}
export function venueRetryDelay(failures){return Math.min(30000,3000*2**Math.min(Math.max(failures-1,0),4));}
