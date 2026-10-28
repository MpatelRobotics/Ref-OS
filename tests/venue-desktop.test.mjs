import test from 'node:test';
import assert from 'node:assert/strict';
import { _electron as electron } from '@playwright/test';
test('venue desktop starts, serves the app, stops and preserves records without external Node', {timeout:40000},async()=>{
 const desktop=await electron.launch({...(process.env.REFOS_VENUE_PACKAGED_EXE?{executablePath:process.env.REFOS_VENUE_PACKAGED_EXE,args:[]}:{args:['venue-desktop/build/main.mjs']}),env:{...process.env,REFOS_VENUE_DESKTOP_TEST:'1'}});
 try{
  const page=await desktop.firstWindow();await page.waitForLoadState('domcontentloaded');
  assert.equal(await page.title(),'Ref OS Venue Server');
  assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
  await page.getByLabel('Server port').fill('18763');await page.getByRole('button',{name:'Start Server',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Server running');
  const health=await fetch('http://localhost:18763/api/v1/health').then(r=>r.json());assert.equal(health.service,'refos-venue-server');
  const initial=await page.evaluate(()=>window.venueHost.action('state'));assert.ok(initial.backups.length>0);
  if(initial.addresses.length){const qr=await page.evaluate(address=>window.venueHost.action('qr',address),initial.addresses[0]);assert.match(qr.qr,/^data:image\/png;base64,/);const {PNG}=(await import('pngjs')).default;const jsQR=(await import('jsqr')).default;const png=PNG.sync.read(Buffer.from(qr.qr.split(',')[1],'base64'));assert.equal(jsQR(new Uint8ClampedArray(png.data),png.width,png.height).data,initial.addresses[0]);}
  await page.getByRole('button',{name:'Check Readiness',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#checks').textContent.includes('Server responds'));
  assert.match(await page.locator('#checks').innerText(),/Needs attention: Two devices/);
  const eventPath='http://localhost:18763/api/v1/events/11111111-1111-4111-8111-111111111111';
  const headers={Authorization:'Bearer '+'a'.repeat(64),'Content-Type':'application/json','X-Refos-Device':'one','X-Refos-Device-Label':'Ref%20One'};
  assert.equal((await fetch(eventPath+'/register',{method:'POST',headers,body:'{}'})).status,200);
  assert.equal((await fetch(eventPath+'/changes',{method:'POST',headers,body:JSON.stringify({changes:[{changeId:'ready-one',kind:'roster',recordId:'ref',op:'upsert',data:{name:'Ref One'}}]})})).status,200);
  for(const id of ['one','two'])await fetch(eventPath+'/changes?since=1',{headers:{...headers,'X-Refos-Device':id,'X-Refos-Device-Label':id==='one'?'Ref%20One':'Ref%20Two'}});
  await page.getByRole('button',{name:'Check Readiness',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#checks').textContent.includes('Passed: Two devices received shared data'));
  assert.match(await page.locator('#devices').innerText(),/Ref Two/);
  if(process.env.REFOS_VENUE_SCREENSHOT==='1')await page.screenshot({path:'venue-desktop/build/preview.png',fullPage:true});
  assert.equal(await page.getByRole('button',{name:'Restore Selected Backup',exact:true}).isDisabled(),true);
  assert.match(await fetch('http://localhost:18763/').then(r=>r.text()),/<html/);
  const data=await page.locator('#data').textContent();assert.match(data,/refos-venue-desktop-/);
  await page.getByRole('button',{name:'Stop Server',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Server stopped');
  await assert.rejects(fetch('http://localhost:18763/api/v1/health'));
  await page.getByRole('button',{name:'Start Server',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Server running');
  assert.equal(await page.locator('#data').textContent(),data);
  await page.getByRole('button',{name:'Stop Server',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Server stopped');
 }finally{await desktop.close();}
});

