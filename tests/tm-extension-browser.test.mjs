import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {WebSocketServer} from 'ws';
import {createHmac} from 'node:crypto';
import {mkdtemp,cp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

test('Chrome extension reads signed TM data and real live WebSocket events, then disconnects', {timeout:60000}, async()=>{
 const resources={
 '/api/event':{event:{name:'Extension test',code:'RE-V5RC-26-1234'}},
 '/api/divisions':{divisions:[{id:1,name:'Main'}]},'/api/teams/1':{teams:[{number:'1A',name:'Example'}]},
 '/api/matches/1':{matches:[]},'/api/rankings/1/QUAL':{rankings:[]},'/api/skills':{skillsRankings:[]},
 '/api/fieldsets':{fieldSets:[{id:1,name:'Set'}]},'/api/fieldsets/1/fields':{fields:[{id:4,name:'Main field'}]},
 };
 const verified=[],upgrades=[];
 const valid=request=>{const date=request.headers['x-tm-date'];const signature=createHmac('sha256','test-key').update(`GET\n${request.url}\ntoken:test-token\nhost:${request.headers.host}\nx-tm-date:${date}\n`).digest('hex');return request.headers.authorization==='Bearer test-token'&&request.headers['x-tm-signature']===signature;};
 const server=createServer((req,res)=>{if(!valid(req)){res.writeHead(401);res.end('{}');return;}verified.push(req.url);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(resources[req.url]||{}));});
 const wss=new WebSocketServer({noServer:true});
 server.on('upgrade',(req,socket,head)=>{upgrades.push({valid:valid(req),headers:req.headers});if(!valid(req)){socket.destroy();return;}verified.push('websocket');wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));});
 wss.on('connection',socket=>{socket.send(JSON.stringify({type:'fieldMatchAssigned',fieldID:4,match:{division:1,session:1,round:'QUAL',match:2,instance:1}}));socket.send(JSON.stringify({type:'fieldActivated',fieldID:4}));socket.send(JSON.stringify({type:'matchStarted',fieldID:4}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const address=`http://127.0.0.1:${server.address().port}`;
 const dir=await mkdtemp(join(tmpdir(),'refos-extension-'));const extension=join(dir,'extension');await cp(resolve('browser-extension/build'),extension,{recursive:true});
 const manifest=JSON.parse(await readFile(join(extension,'manifest.json'),'utf8'));manifest.host_permissions.push('http://127.0.0.1/*','ws://127.0.0.1/*');await writeFile(join(extension,'manifest.json'),JSON.stringify(manifest));
 let context;
 try{
  context=await chromium.launchPersistentContext(join(dir,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(async address=>{await chrome.storage.local.set({address});const original=globalThis.fetch;globalThis.fetch=(url,options)=>String(url).endsWith('/functions/v1/tm-api-token')?Promise.resolve(new Response(JSON.stringify({accessToken:'test-token'}),{status:200})):original(url,options);},address);
  await context.route('https://www.ref-os.fyi/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Ref OS extension test</h1>'}));
  const page=await context.newPage();await page.goto('https://www.ref-os.fyi/');
  const request=(route,body={})=>page.evaluate(({route,body})=>new Promise((resolve,reject)=>{const id=crypto.randomUUID();const timer=setTimeout(()=>reject(Error('Extension reply timeout')),15000);const listener=event=>{if(event.data?.source==='refos-tm-extension'&&event.data.id===id){clearTimeout(timer);window.removeEventListener('message',listener);event.data.ok?resolve(event.data.data):reject(Error(event.data.error));}};window.addEventListener('message',listener);window.postMessage({source:'refos-tm-page',id,route,body},location.origin);}),{route,body});
  assert.equal((await request('ping')).liveFields,true);
  await worker.evaluate(async address=>chrome.storage.session.set({tmCredentials:{address,apiKey:'test-key'}}),address);
  assert.deepEqual(await request('credentials'),{address,apiKey:'test-key'});
  await worker.evaluate(()=>chrome.storage.session.remove('tmCredentials'));
  assert.deepEqual(await request('credentials'),{address,apiKey:''});
  const result=await request('snapshot',{address,apiKey:'test-key',authorization:'Bearer account-token',anonKey:'public-key',eventId:'event-one',division:1,liveFields:true});
  assert.equal(result.teams[0].number,'1A');assert.ok(result.connectionId);assert.equal(result.fieldError,'');
  let activity;for(let i=0;i<20;i++){activity=await request('activity',{connectionId:result.connectionId});if(activity.fieldSets[0]?.fields[0]?.status==='playing')break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(activity.fieldSets[0].fields[0].status,'playing',JSON.stringify({verified,upgrades,activity}));assert.equal(activity.fieldSets[0].fields[0].match.match,2);assert.equal(activity.fieldSets[0].fields[0].active,true);assert.ok(verified.includes('websocket'));
  for(const socket of wss.clients)socket.send(JSON.stringify({type:'matchStopped',fieldID:4}));
  for(let i=0;i<20;i++){activity=await request('activity',{connectionId:result.connectionId});if(activity.fieldSets[0]?.fields[0]?.status==='stopped')break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(activity.fieldSets[0].fields[0].status,'stopped');
  assert.deepEqual(await worker.evaluate(()=>chrome.declarativeNetRequest.getSessionRules()),[]);
  await request('disconnect',{connectionId:result.connectionId});
  for(let i=0;i<20&&wss.clients.size;i++)await new Promise(r=>setTimeout(r,50));
  assert.equal(wss.clients.size,0);
  await assert.rejects(()=>request('snapshot',{address:'http://127.0.0.1:1',apiKey:'test-key',authorization:'Bearer account-token',anonKey:'public-key',eventId:'event-one',division:1}),/allow this TM server/);
 }finally{if(context)await context.close();for(const ws of wss.clients)ws.terminate();await new Promise(r=>server.close(r));wss.close();}
});
