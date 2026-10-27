import test from 'node:test';
import assert from 'node:assert/strict';
import {createSettingsReadCache} from '../src/settingsReadCache.js';
function setup(){
 let rows=[{key:'logo',updated_at:'1',value:'x'.repeat(500000)},{key:'rankings',updated_at:'1',value:[1,2]}],bytes=0;
 const calls=[];
 const cache=createSettingsReadCache({metadata:async()=>{const r=rows.map(({key,updated_at})=>({key,updated_at}));bytes+=JSON.stringify(r).length;return r;},values:async(event,keys)=>{calls.push(keys);const r=rows.filter(r=>!keys||keys.includes(r.key));bytes+=JSON.stringify(r).length;return structuredClone(r);}});
 return {cache,calls,set:next=>rows=next,rows:()=>rows,bytes:()=>bytes};
}
test('unchanged large values are downloaded once, updates and deletions are respected',async()=>{
 const x=setup();
 await x.cache.read('user','event');
 for(let i=0;i<100;i++)await x.cache.read('user','event');
 assert.equal(x.calls.length,1);
 assert.ok(x.bytes()<520000,'100 refreshes must avoid repeatedly transferring the 500KB logo');
 x.set([x.rows()[0],{key:'rankings',updated_at:'2',value:[9]}]);
 const updated=await x.cache.read('user','event');
 assert.deepEqual(x.calls[1],['rankings']);assert.deepEqual(updated.find(r=>r.key==='rankings').value,[9]);
 x.set([x.rows()[0]]);
 assert.equal((await x.cache.read('user','event')).length,1);
});
test('concurrent reads coalesce and different users and events never share cached values',async()=>{
 const x=setup();
 await Promise.all([x.cache.read('a','event'),x.cache.read('a','event')]);
 assert.equal(x.calls.length,1);
 await x.cache.read('b','event');await x.cache.read('a','other');
 assert.equal(x.calls.length,3);
});
test('failed fetches are retried and null timestamps are fetched conservatively',async()=>{
 let failed=true,calls=0;
 const cache=createSettingsReadCache({metadata:async()=>[{key:'x',updated_at:null}],values:async()=>{calls++;if(failed)throw Error('offline');return [{key:'x',updated_at:null,value:1}];}});
 await assert.rejects(cache.read('a','e'));failed=false;
 await cache.read('a','e');await cache.read('a','e');
 assert.equal(calls,3);
});
