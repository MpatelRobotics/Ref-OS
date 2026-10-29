import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSessionEnsurer} from '../src/anonymousSession.js';
import {loadWorkspaceEvent} from '../src/loadWorkspaceEvent.js';
import {DEMO_EVENTS} from '../src/demoEvents.js';
test('parallel startup calls create just one anonymous account',async()=>{
 let reads=0,signIns=0;const session={user:{id:'one'}};
 const ensure=createSessionEnsurer({getSession:async()=>{reads++;await Promise.resolve();return {data:{session:null}};},signInAnonymously:async()=>{signIns++;return {data:{session}};}});
 const rows=await Promise.all([ensure(),ensure(),ensure()]);assert.equal(reads,1);assert.equal(signIns,1);assert.ok(rows.every(row=>row===session));
});
test('failed anonymous startup is retryable and existing sessions are retained',async()=>{
 let fail=true;const ensure=createSessionEnsurer({getSession:async()=>fail?{error:Error('offline')}:{data:{session:{user:{id:'existing'}}}},signInAnonymously:()=>{throw Error('must not replace existing user');}});
 await assert.rejects(ensure(),/offline/);fail=false;assert.equal((await ensure()).user.id,'existing');
});
test('demo read failure renews demo access and retries without fabricated event data',async()=>{
 let reads=0,claims=0;const api={getEvent:async()=>++reads===1?null:{id:DEMO_EVENTS.v5},claimEventAccess:async(id,code)=>{claims++;assert.equal(id,DEMO_EVENTS.v5);assert.equal(code,'DEMOV5');}};
 assert.equal((await loadWorkspaceEvent(api,DEMO_EVENTS.v5)).id,DEMO_EVENTS.v5);assert.equal(claims,1);
});
test('normal events never use the public demo recovery path',async()=>{
 await assert.rejects(loadWorkspaceEvent({getEvent:async()=>null,claimEventAccess:()=>{throw Error('wrong recovery');}},'private-event'),/access could not/);
});
