import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openStore} from '../venue-server/store.mjs';
import {makeBackup,backups,restoreBackup,hostDevices,readiness} from '../venue-desktop/hostTools.mjs';
const event='11111111-1111-4111-8111-111111111111';
test('consistent snapshots restore older data and keep the current data as a backup',()=>{
 const dir=mkdtempSync(join(tmpdir(),'refos-host-backup-'));let store=openStore(dir);
 try{
  store.registerEvent(event,'a'.repeat(64),'one',Date.now());
  const old=makeBackup(store,dir);
  store.applyChanges(event,'one',[{changeId:'first',kind:'roster',recordId:'ref',op:'upsert',data:{name:'Ref One'}}],Date.now());
  store.close();store=null;restoreBackup(dir,old);
  store=openStore(dir);assert.equal(store.exportRecords(event).length,0);assert.equal(store.listEvents().length,1);
  assert.ok(backups(dir).length>=2);assert.throws(()=>restoreBackup(dir,'../outside.sqlite'),/Choose/);
 }finally{store?.close();}
});
test('backup rotation keeps only app snapshots and never touches unrelated files',()=>{
 const dir=mkdtempSync(join(tmpdir(),'refos-host-rotation-'));const store=openStore(dir);
 try{makeBackup(store,dir);writeFileSync(join(dir,'backups','keep-me.txt'),'untouched');for(let i=0;i<26;i++)makeBackup(store,dir);assert.equal(backups(dir).length,24);assert.equal(readFileSync(join(dir,'backups','keep-me.txt'),'utf8'),'untouched');assert.equal(readdirSync(join(dir,'backups')).length,25);}finally{store.close();}
});
test('readiness needs two active devices acknowledging data in the same event',()=>{
 const dir=mkdtempSync(join(tmpdir(),'refos-host-devices-'));const store=openStore(dir),now=Date.now();
 try{store.registerEvent(event,'a'.repeat(64),'one',now);for(const id of ['one','two'])store.touchDevice(event,id,'Ref '+id,now);
  let devices=hostDevices(store,now);assert.equal(devices.length,2);assert.equal(readiness({health:true,addresses:['http://test'],devices,events:1,backupError:''})[3].ok,false);
  store.applyChanges(event,'one',[{changeId:'first',kind:'roster',recordId:'ref',op:'upsert',data:{name:'Ref One'}}],now);
  for(const id of ['one','two'])store.acknowledgeDevice(event,id,1);
  devices=hostDevices(store,now);assert.equal(readiness({health:true,addresses:['http://test'],devices,events:1,backupError:''})[3].ok,true);
  assert.equal(readiness({health:true,addresses:['http://test'],devices:hostDevices(store,now+91000),events:1,backupError:''})[3].ok,false);
 }finally{store.close();}
});
