import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveDeveloperEventAccess} from '../src/developerEventAccess.js';
test('an active Developer session replaces a saved Admin or missing event role only after server enrollment',async()=>{
 for(const current of [null,{role:'admin',developer:false},{role:'ref',developer:false}]){
  const calls=[];const result=await resolveDeveloperEventAccess('event-one',current,{hasDeveloperSession:async()=>true,openDeveloperEvent:async id=>calls.push(id)});
  assert.deepEqual(calls,['event-one']);assert.equal(result.role,'admin');assert.equal(result.developer,true);
 }
});
test('ordinary sessions stay ordinary and refused Developer enrollment cannot bypass the profile gate',async()=>{
 const current={role:'admin',developer:false};
 assert.equal(await resolveDeveloperEventAccess('one',current,{hasDeveloperSession:async()=>false,openDeveloperEvent:async()=>assert.fail('Must not enroll')}),current);
 await assert.rejects(resolveDeveloperEventAccess('one',current,{hasDeveloperSession:async()=>true,openDeveloperEvent:async()=>{throw Error('Access revoked');}}),/Access revoked/);
});
test('existing server-confirmed Developer membership needs no extra enrollment',async()=>{
 const current={role:'admin',developer:true};assert.equal(await resolveDeveloperEventAccess('one',current,{hasDeveloperSession:async()=>assert.fail('Already verified'),openDeveloperEvent:async()=>assert.fail('Already enrolled')}),current);
});
