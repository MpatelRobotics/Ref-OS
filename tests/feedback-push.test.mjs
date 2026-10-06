import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

async function harness({kind='feedback',denied=false,duplicate=false}={}) {
 const calls=[],sent=[];
 const members=[{user_id:'dev',role:'admin',developer:true,event_id:'another'},{user_id:'admin',role:'admin',developer:false,event_id:'source'}];
 const subscriptions=[{endpoint:'dev-device',user_id:'dev',event_id:'another',p256dh:'key',auth:'key'},{endpoint:'admin-device',user_id:'admin',event_id:'source',p256dh:'key',auth:'key'}];
 const client=service=>({from(table){const filters=[];let operation='select';const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},in(k,v){filters.push([k,v]);return q;},insert(){operation='insert';return q;},update(){operation='update';return q;},delete(){return q;},single(){return q;},maybeSingle(){return q;},then(resolve){calls.push({table,filters,service,operation});let data=null,error=null;
 if(table==='field_log'){data=denied?null:{id:'feedback-1',event_id:'source',kind,note:'private text'};error=denied?{message:'denied'}:null;}
 if(table==='push_dispatches'&&operation==='insert'&&duplicate)error={code:'23505'};
 if(table==='event_members'||table==='push_subscriptions'){data=(table==='event_members'?members:subscriptions).filter(row=>filters.every(([k,v])=>Array.isArray(v)?v.includes(row[k]):row[k]===v));}
 resolve({data,error});}};return q;}});
 let handler;
 const Deno={env:{get:key=>key},serve:fn=>{handler=fn;}};
 const webpush={setVapidDetails(){},async sendNotification(subscription,payload){sent.push({endpoint:subscription.endpoint,payload:JSON.parse(payload)});}};
 const source=(await readFile(new URL('../supabase/functions/send-code-request-push/index.ts',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 const compiled=await transform(source,{loader:'ts',format:'cjs'});
 new Function('Deno','createClient','webpush',compiled.code)(Deno,(_url,key)=>client(key==='SUPABASE_SERVICE_ROLE_KEY'),webpush);
 const result=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({requestId:'feedback-1'})}));
 return {result,sent,calls};
}
test('feedback reaches verified Developer devices across events without private contents',async()=>{
 const {result,sent}=await harness();assert.equal(result.status,200);assert.deepEqual(sent.map(s=>s.endpoint),['dev-device']);assert.equal(sent[0].payload.url,'/?open=universal-feedback');assert.doesNotMatch(JSON.stringify(sent),/private text/);
});
test('inaccessible feedback cannot dispatch',async()=>{const {result,sent,calls}=await harness({denied:true});assert.equal(result.status,404);assert.equal(sent.length,0);assert.equal(calls.some(c=>c.table==='push_dispatches'),false);});
test('duplicate dispatch is suppressed',async()=>{const {result,sent}=await harness({duplicate:true});assert.equal(result.status,200);assert.equal(sent.length,0);assert.equal((await result.json()).duplicate,true);});
test('help request delivery remains scoped to its event',async()=>{const {sent}=await harness({kind:'help_request'});assert.deepEqual(sent.map(s=>s.endpoint),['admin-device']);});
