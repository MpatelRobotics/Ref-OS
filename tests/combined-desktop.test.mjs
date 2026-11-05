import test from 'node:test';
import assert from 'node:assert/strict';
import {_electron as electron} from '@playwright/test';
test('combined desktop hosts venue independently while opening secure TM website', {timeout:45000}, async()=>{
 const app=await electron.launch({...(process.env.REFOS_PACKAGED_EXE?{executablePath:process.env.REFOS_PACKAGED_EXE,args:[]}:{args:['desktop/build/main.mjs']}),env:{...process.env,REFOS_DESKTOP_TEST:'1'}});
 try{
  const home=await app.firstWindow();await home.waitForLoadState('domcontentloaded');
  assert.equal(await home.title(),'Ref-OS Desktop');
 const launcherUrl=home.url();
  await home.route('https://ref-os.vercel.app/**',r=>r.fulfill({contentType:'text/html',body:'<h1>Ref OS test</h1>'}));
 await home.getByLabel('Ref OS website address').fill('https://ref-os.vercel.app');await home.getByRole('button',{name:'Open Ref OS',exact:true}).click();await home.waitForURL('https://ref-os.vercel.app/');
 const opened=app.waitForEvent('window');await home.evaluate(()=>window.refosTmDesktop.openVenueServer());const venue=await opened;await venue.waitForLoadState('domcontentloaded');
  assert.equal(await venue.evaluate(()=>typeof window.require),'undefined');
  await venue.getByLabel('Server port').fill('18765');await venue.getByRole('button',{name:'Start Server',exact:true}).click();
  await venue.waitForFunction(()=>document.querySelector('#status').textContent==='Server running');
  assert.equal((await fetch('http://localhost:18765/api/v1/health').then(r=>r.json())).service,'refos-venue-server');
  assert.match(await fetch('http://localhost:18765/').then(r=>r.text()),/<html/);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/venue/index.html')).close());
  assert.equal(await venue.evaluate(()=>window.venueHost.action('state').then(s=>s.running)),true);
  await home.evaluate(()=>window.refosTmDesktop.openVenueServer());
  await app.evaluate(async ({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('/venue/')).loadURL(url),launcherUrl);
  await home.route('https://refos.example.test/**',r=>r.fulfill({contentType:'text/html',body:'<h1>Ref OS test</h1>'}));
  await home.getByLabel('Ref OS website address').fill('https://refos.example.test');await home.getByRole('button',{name:'Open Ref OS',exact:true}).click();await home.waitForURL('https://refos.example.test/');
  assert.equal(await home.evaluate(()=>typeof window.refosTmDesktop.request),'function');
  assert.equal(await home.evaluate(async()=>{try{await window.refosTmDesktop.openVenueServer();return false;}catch{return true;}}),true);
  assert.equal((await fetch('http://localhost:18765/api/v1/health')).status,200);
  await venue.getByRole('button',{name:'Stop Server',exact:true}).click();await venue.waitForFunction(()=>document.querySelector('#status').textContent==='Server stopped');
  await assert.rejects(fetch('http://localhost:18765/api/v1/health'));
 }finally{await app.close();}
});
