import {createMobileTmClient} from '../src/tmMobileClient.js';
import {createTmClientPool} from '../src/tmClientPool.js';
import {createExtensionSockets} from './sockets.js';
import {CLOUD,websiteAllowed,hostPatterns,validateRequest,allowedHttp} from './security.js';
const tabs=new Map();
const init=(async()=>{const rules=await chrome.declarativeNetRequest.getSessionRules();if(rules.length)await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:rules.map(r=>r.id)});})();
let nextRule=1;
const proxySockets=new Map();let creatingDocument;
async function ensureDocument(){
 if((await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']})).length)return;
 creatingDocument ||= chrome.offscreen.createDocument({url:'offscreen.html',reasons:['IFRAME_SCRIPTING'],justification:'Script an extension iframe for signed Tournament Manager live field WebSocket connections while Ref OS is syncing.'}).finally(()=>{creatingDocument=null;});
 await creatingDocument;
}
class FieldSocket {
 constructor(url){this.id=crypto.randomUUID();proxySockets.set(this.id,this);queueMicrotask(()=>chrome.runtime.sendMessage({target:'refos-live-document',type:'open',id:this.id,url}).catch(()=>this.onerror?.()));}
 close(){chrome.runtime.sendMessage({target:'refos-live-document',type:'close',id:this.id}).catch(()=>{});proxySockets.delete(this.id);}
}
chrome.runtime.onMessage.addListener((message,sender)=>{
 if(message?.target!=='refos-live-event'||sender.id!==chrome.runtime.id||sender.tab||sender.url!==chrome.runtime.getURL('offscreen.html'))return;
 const event=message.event,socket=proxySockets.get(event?.id);if(!socket)return;
 if(event.type==='message')socket.onmessage?.({data:event.data});
 else if(event.type==='open')socket.onopen?.();
 else if(event.type==='error')socket.onerror?.();
 else if(event.type==='close'){socket.onclose?.();proxySockets.delete(event.id);}
});
let handshake=Promise.resolve();
async function addressAllowed(value){
 const {address}=await chrome.storage.local.get('address');const u=new URL(value);const origin=u.origin.replace(/^ws:/,'http:').replace(/^wss:/,'https:');
 if(origin!==address||!await chrome.permissions.contains({origins:hostPatterns(address)}))throw Error('Allow this TM server in the Ref OS extension first.');
}
function make(tab){
 const socketBase=createExtensionSockets({WebSocketClass:FieldSocket,chrome:{runtime:chrome.runtime,declarativeNetRequest:{updateSessionRules:async options=>{
   if(options.addRules){for(const rule of options.addRules){const old=rule.id;rule.id=nextRule++;ids.set(old,rule.id);}}
   if(options.removeRuleIds)options.removeRuleIds=options.removeRuleIds.map(id=>{const actual=ids.get(id);ids.delete(id);return actual;});
   return chrome.declarativeNetRequest.updateSessionRules(options);
 }}},allowed:async value=>{await addressAllowed(value);await ensureDocument();}});
 const ids=new Map();
 const sockets={...socketBase,sign:async({key,message})=>{
  const encoder=new TextEncoder();const secret=await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=await crypto.subtle.sign('HMAC',secret,encoder.encode(message));return {signature:[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('')};
 },open:options=>{const task=handshake.then(()=>socketBase.open(options));handshake=task.catch(()=>{});return task;}};
 const http=async options=>{
  const {address}=await chrome.storage.local.get('address');
  if(!allowedHttp(options.url,options.method,address))throw Error('TM extension request destination is not allowed.');
  if(new URL(options.url).origin!==CLOUD)await addressAllowed(options.url);
  const response=await fetch(options.url,{method:options.method,headers:options.headers,body:options.method==='POST'?JSON.stringify(options.data):undefined,redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000)});
  const text=await response.text();if(text.length>12000000)throw Error('TM response is too large.');
  let data;try{data=JSON.parse(text);}catch{throw Error('TM returned an unreadable response. Check the server address and school sign-in page.');}
  return {status:response.status,data};
 };
 const request=createTmClientPool(createMobileTmClient,{http,sockets,cloudUrl:CLOUD});
 return {request,sockets,last:Date.now(),tab};
}
async function closeTab(id){const state=tabs.get(id);if(state){tabs.delete(id);await state.request.closeAll();if(!tabs.size)await chrome.offscreen.closeDocument().catch(()=>{});}}
chrome.tabs.onRemoved.addListener(id=>{void closeTab(id);});
chrome.tabs.onUpdated.addListener((id,change)=>{if(change.status==='loading')void closeTab(id);});
chrome.permissions.onRemoved.addListener(()=>{for(const id of tabs.keys())void closeTab(id);});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.address)for(const id of tabs.keys())void closeTab(id);});
setInterval(()=>{
 for(const [id,state]of tabs){if(Date.now()-state.last>90000)void closeTab(id);}
 // Offscreen field messages keep active connections available; idle leases expire above.

},20000);
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(message?.target!=='refos-tm')return;
 (async()=>{
  await init;
  if(!sender.tab||sender.frameId!==0||!websiteAllowed(sender.url))throw Error('Open the official Ref OS website to use this extension.');
  if(message.route==='ping')return {available:true,version:'1.0.0',liveFields:true};
  const {address}=await chrome.storage.local.get('address');validateRequest(message.route,message.body,address);
  if(message.route==='snapshot')await addressAllowed(address);
  let state=tabs.get(sender.tab.id);if(!state){if(tabs.size>=4)throw Error('Too many Ref OS tabs are connected. Close another tab first.');state=make(sender.tab.id);tabs.set(sender.tab.id,state);}
  state.last=Date.now();
  try{return await state.request(message.route,message.body);}catch(error){throw Error(/^(TM |Enter |Use |Choose |This TM|Event administrator|Sign in|Allow |Open |Could not)/.test(error.message)?error.message:'Could not connect to TM. Check the extension’s allowed server, event Wi-Fi and internet connection.');}
 })().then(data=>reply({ok:true,data}),error=>reply({ok:false,error:error.message}));
 return true;
});
