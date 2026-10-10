import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { applyFieldEvent } from '../tm-bridge/live-fields.mjs';
import { createConnector } from '../tm-bridge/connector.mjs';
import { scopeTmFieldActivity } from '../src/tmFieldActivity.js';
const tuple = { division:1,session:0,round:'QUAL',match:2,instance:1 };
const waitFor = async condition => { const until=Date.now()+5000; while(!condition()){if(Date.now()>until)throw Error('Timed out waiting for live field event');await new Promise(r=>setTimeout(r,20));} };
test('field events preserve assigned identity and reject unsupported fields/messages',()=>{
  const set={fields:[{id:1,status:'unknown',match:null},{id:2,status:'unknown',match:null}]};
  assert.equal(applyFieldEvent(set,{type:'fieldMatchAssigned',fieldID:1,match:tuple},100),true);
  applyFieldEvent(set,{type:'fieldActivated',fieldID:1});assert.equal(set.fields[0].active,true);assert.equal(set.fields[1].active,false);
  applyFieldEvent(set,{type:'matchStarted',fieldID:1});assert.equal(set.fields[0].status,'playing');
  applyFieldEvent(set,{type:'matchStopped',fieldID:1});assert.equal(set.fields[0].status,'stopped');assert.equal(set.fields[0].match.match,2);
  assert.equal(applyFieldEvent(set,{type:'matchStarted',fieldID:999}),false);
  assert.equal(applyFieldEvent(set,{cmd:'start',fieldID:1}),false);
  assert.equal(applyFieldEvent(set,{type:'fieldMatchAssigned',fieldID:1,match:{...tuple,session:-1}}),false);
});
test('shared field snapshot is restricted to selected division and session',()=>{
  const result=scopeTmFieldActivity({fieldSets:[{id:1,name:'Set',connected:true,fields:[{id:1,name:'Yellow',status:'playing',match:tuple},{id:2,name:'Green',status:'playing',match:{...tuple,division:2}},{id:3,name:'Purple',status:'queued',match:{...tuple,session:1}}]}]},1,0);
  assert.equal(result[0].fields.length,1);assert.equal(result[0].fields[0].name,'Yellow');
});
test('real signed WebSocket receives live events, reconnects without guessing, and sends no TM commands',async t=>{
  const tm=createServer(), sockets=[];
  const wss=new WebSocketServer({server:tm});let commands=0;
  wss.on('connection',(socket,request)=>{
    sockets.push(socket);
    assert.equal(request.url,'/api/fieldsets/1');assert.equal(request.headers.authorization,'Bearer oauth-token');
    const message=`GET\n/api/fieldsets/1\ntoken:oauth-token\nhost:${request.headers.host}\nx-tm-date:${request.headers['x-tm-date']}\n`;
    assert.equal(request.headers['x-tm-signature'],createHmac('sha256','event-key').update(message).digest('hex'));
    socket.on('message',()=>commands++);
  });
  await new Promise(r=>tm.listen(0,'127.0.0.1',r));
  const connector=createConnector({origin:'https://refos.test',pairingCode:'paired',cloudUrl:'https://cloud.test',fetcher:async(url)=>{
    const path=new URL(url).pathname;
    const resources={'/functions/v1/tm-api-token':{accessToken:'oauth-token'},'/api/event':{event:{name:'Test',code:'CODE'}},'/api/divisions':{divisions:[{id:1,name:'Division 1'}]},'/api/teams/1':{teams:[]},'/api/matches/1':{matches:[]},'/api/rankings/1/QUAL':{rankings:[]},'/api/skills':{skillsRankings:[]},'/api/fieldsets':{fieldSets:[{id:1,name:'Match field set'}]},'/api/fieldsets/1/fields':{fields:[{id:1,name:'Yellow field'},{id:2,name:'Green field'}]}};
    return new Response(JSON.stringify(resources[path]),{headers:{'Content-Type':'application/json'}});
  }});
  await new Promise(r=>connector.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>connector.close(r));for(const s of sockets)s.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>tm.close(r));});
  const base=`http://127.0.0.1:${connector.address().port}`;
  const send=(path,body)=>fetch(`${base}/${path}`,{method:'POST',headers:{Origin:'https://refos.test','x-refos-pairing':'paired','Content-Type':'application/json'},body:JSON.stringify(body)});
  const snapshot=await (await send('snapshot',{address:`http://127.0.0.1:${tm.address().port}`,apiKey:'event-key',authorization:'Bearer user-token',anonKey:'public',eventId:'event',division:1,liveFields:true})).json();
  assert.ok(snapshot.connectionId);await waitFor(()=>sockets.length===1);
  const activity=async()=>await (await send('activity',{connectionId:snapshot.connectionId})).json();
  sockets[0].send(JSON.stringify({type:'fieldMatchAssigned',fieldID:1,match:tuple}));
  sockets[0].send(JSON.stringify({type:'fieldActivated',fieldID:1}));
  sockets[0].send(JSON.stringify({type:'matchStarted',fieldID:1}));
  let state;
  await waitFor(()=>{return sockets[0].readyState===1;});
  for(let i=0;i<20;i++){state=await activity();if(state.fieldSets[0].fields[0].status==='playing')break;await new Promise(r=>setTimeout(r,20));}
  assert.equal(state.fieldSets[0].fields[0].status,'playing');assert.equal(state.fieldSets[0].fields[0].match.match,2);assert.equal(state.fieldSets[0].fields[0].active,true);
  sockets[0].terminate();await waitFor(()=>sockets.length===2);
  state=await activity();assert.equal(state.fieldSets[0].fields[0].status,'unknown');
  sockets[1].send(JSON.stringify({type:'matchStopped',fieldID:1}));
  await new Promise(r=>setTimeout(r,30));assert.equal((await activity()).fieldSets[0].fields[0].status,'stopped');assert.equal(commands,0);
  const second=await (await send('snapshot',{address:`http://127.0.0.1:${tm.address().port}`,apiKey:'event-key',authorization:'Bearer user-token',anonKey:'public',eventId:'event',division:1,liveFields:true,channelId:'server-2'})).json();
  assert.equal(second.multiServer,true);assert.notEqual(second.connectionId,snapshot.connectionId);await waitFor(()=>sockets.length===3);
  await send('disconnect',{connectionId:snapshot.connectionId});assert.equal((await send('activity',{connectionId:snapshot.connectionId})).status,409);
  assert.equal((await send('activity',{connectionId:second.connectionId})).status,200);assert.equal(sockets[2].readyState,1);
  await send('disconnect',{connectionId:second.connectionId});
});
