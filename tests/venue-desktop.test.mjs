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
  assert.match(await fetch('http://localhost:18763/').then(r=>r.text()),/<html/);
  const data=await page.locator('#data').textContent();assert.match(data,/refos-venue-desktop-/);
  await page.getByRole('button',{name:'Stop Server',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Server stopped');
  await assert.rejects(fetch('http://localhost:18763/api/v1/health'));
  await page.getByRole('button',{name:'Start Server',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Server running');
  assert.equal(await page.locator('#data').textContent(),data);
  await page.getByRole('button',{name:'Stop Server',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Server stopped');
 }finally{await desktop.close();}
});

