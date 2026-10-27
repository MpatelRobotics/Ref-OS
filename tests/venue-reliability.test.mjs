import test from 'node:test';
import assert from 'node:assert/strict';
import {settleVenueBatch,venueRetryDelay} from '../src/sync/venueReliability.js';
import {venueSetupPage} from '../venue-server/setup-page.mjs';
const batch=[{changeId:'one',kind:'violation',recordId:'v'}];
test('queued changes survive pull failure after server accepted a write',async()=>{
 let removed=false;
 await assert.rejects(settleVenueBatch({batch,results:[{changeId:'one',status:'applied'}],pull:async()=>{throw Error('Wi-Fi lost');},preserveRejected:async()=>{},removeAccepted:async()=>{removed=true;}}));
 assert.equal(removed,false);
});
test('canonical state and rejected work persist before acknowledgment removes queue',async()=>{
 const order=[];
 await settleVenueBatch({batch,results:[{changeId:'one',status:'rejected_deleted'}],pull:async()=>order.push('mirror'),preserveRejected:async r=>{assert.equal(r.length,1);order.push('recovery');},removeAccepted:async ids=>{assert.ok(ids.has('one'));order.push('queue');}});
 assert.deepEqual(order,['mirror','recovery','queue']);
});
test('missing and unknown acknowledgments never discard local changes',async()=>{
 await assert.rejects(settleVenueBatch({batch,results:[{changeId:'one',status:'unknown'}]}));
});
test('reconnection retry delay is bounded',()=>{assert.equal(venueRetryDelay(1),3000);assert.equal(venueRetryDelay(3),12000);assert.equal(venueRetryDelay(99),30000);});
test('setup page lists connection addresses and escapes input',()=>{
 const html=venueSetupPage({addresses:[{address:'192.168.1.9'},{address:'<script>'}],port:8080,webReady:true});
 assert.match(html,/http:\/\/192.168.1.9:8080/);assert.ok(!html.includes('<script>'));assert.match(html,/Initial sign-in/);
});

test('two local devices exchange changes once and server restart retains records',async()=>{
 const {createVenueServer}=await import('../venue-server/server.mjs');
 const {mkdtempSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join,resolve,sep}=await import('node:path');
 const dataDir=mkdtempSync(join(tmpdir(),'refos-venue-test-'));
 const config={dataDir,port:0,host:'127.0.0.1',webRoot:null,allowedOrigins:[],maxChangesPerRequest:200,maxBodyBytes:8*1024*1024,quiet:true};
 let running;
 const start=async()=>{running=createVenueServer(config);await new Promise(r=>running.server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+running.server.address().port;};
 const stop=async()=>{await new Promise(r=>running.server.close(r));running.store.close();running=null;};
 try{
  let url=await start();
  assert.match(await (await fetch(url+'/setup')).text(),/Venue Server is running/);
  const event='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const headers={Authorization:'Bearer '+'a'.repeat(64),'X-Refos-Device':'device-a','Content-Type':'application/json'};
  assert.equal((await fetch(url+'/api/v1/events/'+event+'/register',{method:'POST',headers,body:'{}'})).status,200);
  const change={changeId:'test-write',kind:'roster',recordId:'sample-ref',op:'upsert',data:{name:'Sample Ref',role:'ref'}};
  const post=()=>fetch(url+'/api/v1/events/'+event+'/changes',{method:'POST',headers,body:JSON.stringify({changes:[change]})}).then(r=>r.json());
  assert.equal((await post()).results[0].status,'applied');
  assert.equal((await post()).results[0].status,'duplicate');
  const pulled=await(await fetch(url+'/api/v1/events/'+event+'/changes?since=0',{headers:{...headers,'X-Refos-Device':'device-b'}})).json();
  assert.equal(pulled.changes.length,1);
  await stop();url=await start();
  const restored=await(await fetch(url+'/api/v1/events/'+event+'/changes?since=0',{headers})).json();
  assert.equal(restored.changes[0].data.name,'Sample Ref');
 }finally{
  if(running)await stop();
  if(resolve(dataDir).startsWith(resolve(tmpdir())+sep))rmSync(dataDir,{recursive:true,force:true});
 }
});
