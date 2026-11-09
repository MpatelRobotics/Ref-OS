import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {transformSync} from 'esbuild';
const source=transformSync(readFileSync('supabase/functions/refos-developer-access/index.ts','utf8').replace(/^import .*;\r?\n/,''),{loader:'ts',format:'esm'}).code;
async function invoke(body,{secret='9Z99',setupError=null}={}) {
 let handler;const calls=[];
 const client=type=>({auth:{getUser:async()=>({data:{user:{id:'visitor'}}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:body.eventId,archived_at:null}})})})}),rpc:async(name,args)=>{calls.push({type,name,args});if(name==='refos_access_locked')return {data:false};if(name==='complete_initial_admin_setup')return {error:setupError};return {data:[{id:'created-event'}]};}});
 vm.runInNewContext(source,{Deno:{env:{get:key=>({REFOS_SUPER_ADMIN_CODE:secret,SUPABASE_URL:'https://example.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'})[key]},serve:fn=>handler=fn},createClient:(url,key)=>client(key),crypto:webcrypto,TextEncoder,Response,console});
 const response=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer session','Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json(),calls};
}
const eventId='22222222-2222-4222-8222-222222222222';
test('developer creation never stores the submitted credential',async()=>{const r=await invoke({action:'create',name:'Test event',format:'league',credential:'9z99'});assert.equal(r.body.ok,true);assert.deepEqual(r.calls.map(x=>[x.type,x.name]),[['service','create_deferred_admin_event']]);assert.equal(r.calls[0].args.p_format,'league');assert.equal(JSON.stringify(r.calls).includes('9Z99'),false);});
test('ordinary event creation retains the authenticated admin code path',async()=>{const r=await invoke({action:'create',name:'Test event',format:'tournament',credential:'3S23'});assert.equal(r.body.ok,true);assert.equal(r.calls[0].type,'anon');assert.equal(r.calls[0].name,'create_refos_vex_event_with_format');});
test('missing developer configuration fails closed before storing a credential',async()=>{const r=await invoke({action:'create',name:'Test event',credential:'9Z99'},{secret:''});assert.equal(r.status,503);assert.equal(r.calls.length,0);});
test('initial admin code cannot be the developer secret',async()=>{const r=await invoke({action:'setup_admin',eventId,credential:'9Z99'});assert.equal(r.status,400);assert.equal(r.calls.some(x=>x.name==='complete_initial_admin_setup'),false);});
test('setup is granted to the current authenticated identity only',async()=>{const r=await invoke({action:'setup_admin',eventId,credential:'3S23',userId:'attacker-chosen-id'});assert.equal(r.body.ok,true);assert.equal(r.calls.find(x=>x.name==='complete_initial_admin_setup').args.p_user,'visitor');});
test('concurrent setup failure never reports success',async()=>{const r=await invoke({action:'setup_admin',eventId,credential:'3S23'},{setupError:{message:'Admin setup is already complete.'}});assert.equal(r.status,409);assert.equal(r.body.ok,false);});
