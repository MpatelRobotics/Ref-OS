import {signedSocketRule} from './security.js';
export function createExtensionSockets({chrome,WebSocketClass=WebSocket,allowed}){
 const sockets=new Map(),listeners=new Set();let sequence=1,tail=Promise.resolve();
 const emit=event=>{for(const fn of listeners)fn(event);};
 const close=async({id})=>{const row=sockets.get(id);if(!row)return;sockets.delete(id);row.socket.close();row.cancel?.();};
 return {
  async addListener(_name,listener){listeners.add(listener);return {remove:async()=>listeners.delete(listener)};},
  close,async closeAll(){await Promise.all([...sockets.keys()].map(id=>close({id})));},
  open(options){const run=tail.then(async()=>{
   await allowed(options.url);await close({id:options.id});
   const ruleId=sequence++;const rule=signedSocketRule(ruleId,options.url,options.headers,chrome.runtime.id);
   await chrome.declarativeNetRequest.updateSessionRules({addRules:[rule]});
   try{
    await new Promise((resolve,reject)=>{
     const socket=new WebSocketClass(options.url);let settled=false;
     const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve();};
     const timer=setTimeout(()=>{socket.close();finish(Error('TM live field connection timed out.'));},12000);
     sockets.set(options.id,{socket,cancel:()=>finish(Error('TM live field connection cancelled.'))});
     socket.onopen=()=>{emit({id:options.id,type:'open'});finish();};
     socket.onmessage=e=>{if(typeof e.data==='string'&&e.data.length<=100000)emit({id:options.id,type:'message',data:e.data});};
     socket.onerror=()=>{emit({id:options.id,type:'error'});finish(Error('TM live field connection failed. Check its API support and network permissions.'));};
     socket.onclose=()=>{if(sockets.get(options.id)?.socket===socket)sockets.delete(options.id);emit({id:options.id,type:'close'});finish(Error('TM live field connection closed.'));};
    });
   }finally{await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[ruleId]});}
  });tail=run.catch(()=>{});return run;},
 };
}
