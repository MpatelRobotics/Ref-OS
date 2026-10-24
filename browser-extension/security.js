import {normalizeTmAddress} from '../src/tmAddress.js';
export const CLOUD='https://gcibsphjcllspzesqqsw.supabase.co';
export const websiteAllowed=value=>{try{const u=new URL(value);return u.protocol==='https:'&&['www.ref-os.fyi','ref-os.fyi'].includes(u.hostname)&&!u.port;}catch{return false;}};
export const hostPattern=value=>{const u=new URL(normalizeTmAddress(value));return `${u.protocol}//${u.hostname}/*`;};
export const hostPatterns=value=>{const pattern=hostPattern(value);return [pattern,pattern.replace(/^http:/,'ws:').replace(/^https:/,'wss:')];};
export function validateRequest(route,body,address){
 if(!['snapshot','activity','disconnect'].includes(route)||!body||typeof body!=='object'||JSON.stringify(body).length>25000)throw Error('Invalid TM extension request.');
 if(route==='snapshot'){
  if(!address||normalizeTmAddress(body.address)!==address)throw Error('Open the Ref OS extension, allow this TM server address, then retry.');
  if(typeof body.apiKey!=='string'||body.apiKey.length>2000||typeof body.authorization!=='string'||body.authorization.length>12000||typeof body.anonKey!=='string'||body.anonKey.length>4000||typeof body.eventId!=='string'||body.eventId.length>100)throw Error('Enter the event key and sign in to Ref OS.');
 }
}
export function allowedHttp(value,method,address){
 const url=new URL(value);
 if(url.origin===CLOUD&&url.pathname==='/functions/v1/tm-api-token'&&method==='POST'&&!url.search)return true;
 return url.origin===address&&method==='GET'&&!url.search&&/^\/api\/(event|divisions|skills|teams\/\d+|matches\/\d+|rankings\/\d+\/QUAL|fieldsets|fieldsets\/\d+\/fields)$/.test(url.pathname);
}
export function signedSocketRule(id,url,headers,extensionId){
 const u=new URL(url);
 if(!['ws:','wss:'].includes(u.protocol)||!/^\/api\/fieldsets\/\d+$/.test(u.pathname)||u.search||u.username||u.password)throw Error('Invalid TM live field address.');
 return {id,priority:1,action:{type:'modifyHeaders',requestHeaders:Object.entries(headers).map(([header,value])=>({header,operation:'set',value}))},condition:{regexFilter:'^'+url.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$',initiatorDomains:[extensionId],resourceTypes:['websocket']}};
}
