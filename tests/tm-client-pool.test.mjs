import test from 'node:test';
import assert from 'node:assert/strict';
import {createTmClientPool} from '../src/tmClientPool.js';
test('separate server sockets and connection IDs route independently; disconnect closes only its own sockets',async()=>{
 const listeners=[],closed=[],opened=[],received=[];let count=0;
 const sockets={sign:async()=>({signature:'test'}),open:async o=>opened.push(o.id),close:async o=>closed.push(o.id),addListener:async(_,f)=>{listeners.push(f);return {remove:async()=>{}};}};
 const factory=({sockets})=>{
  const id=`connection-${++count}`;
  return {request:async(route)=>{
   if(route==='snapshot'){await sockets.open({id:'1:1'});await sockets.addListener('socketEvent',e=>received.push([id,e.id]));return {connectionId:id};}
   if(route==='disconnect'){await sockets.closeAll();return {};}
   return {id};
  }};
 };
 const request=createTmClientPool(factory,{sockets});
 const a=await request('snapshot',{channelId:'server-1'}),b=await request('snapshot',{channelId:'server-2'});
 assert.equal(a.multiServer,true);assert.notEqual(a.connectionId,b.connectionId);
 assert.deepEqual(opened,['server-1:1:1','server-2:1:1']);
 listeners.forEach(f=>f({id:'server-2:1:1',type:'open'}));assert.deepEqual(received,[[b.connectionId,'1:1']]);
 await request('disconnect',{connectionId:a.connectionId});assert.deepEqual(closed,['server-1:1:1']);
 assert.equal((await request('activity',{connectionId:b.connectionId})).id,b.connectionId);
});
