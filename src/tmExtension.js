let available=false;
const pending=new Map();
export const isTmExtension=()=>available;
export function extensionTmRequest(route,body={}){
 if(typeof window==='undefined')return Promise.reject(Error('TM extension is unavailable.'));
 return new Promise((resolve,reject)=>{
  const id=crypto.randomUUID();
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('TM extension did not respond. Open the extension, check its server access, then reload Ref OS.'));},route==='ping'?2000:60000);
  pending.set(id,{resolve,reject,timer});
  window.postMessage({source:'refos-tm-page',id,route,body},window.location.origin);
 });
}
if(typeof window!=='undefined'){
 window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==window.location.origin||event.data?.source!=='refos-tm-extension')return;
  const request=pending.get(event.data.id);if(!request)return;
  pending.delete(event.data.id);clearTimeout(request.timer);
  event.data.ok?request.resolve(event.data.data):request.reject(Error(event.data.error||'TM extension request failed.'));
 });
 const detect=()=>extensionTmRequest('ping').then(result=>{available=result?.available===true;window.dispatchEvent(new Event('refos-tm-extension-ready'));}).catch(()=>{});
 if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',detect,{once:true});else void detect();
}
