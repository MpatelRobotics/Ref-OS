import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdtemp,cp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:http';
test('venue popup checks real server health, saves independently, opens and forgets the address',async()=>{
 const server=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({service:'refos-venue-server',status:'ok'}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const address=`http://127.0.0.1:${server.address().port}`;
 const dir=await mkdtemp(join(tmpdir(),'refos-venue-extension-'));const extension=join(dir,'extension');await cp(resolve('browser-extension/build'),extension,{recursive:true});
 const manifest=JSON.parse(await readFile(join(extension,'manifest.json'),'utf8'));manifest.host_permissions.push('http://127.0.0.1/*');await writeFile(join(extension,'manifest.json'),JSON.stringify(manifest));
 let context;
 try{
 context=await chromium.launchPersistentContext(join(dir,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=new URL(worker.url()).host;
 await worker.evaluate(()=>chrome.storage.local.set({address:'http://tm.example:8080'}));
 const page=await context.newPage();await page.goto(`chrome-extension://${id}/popup.html`);
 await page.evaluate(()=>{chrome.permissions.request=async()=>true;chrome.permissions.remove=async()=>true;});
 await page.locator('#venueAddress').fill(address);await page.getByRole('button',{name:'Save and check venue server'}).click();
 await page.getByText('Venue server connected.',{exact:false}).waitFor();
 assert.equal(await worker.evaluate(()=>chrome.storage.local.get('venueAddress').then(s=>s.venueAddress)),address);
 assert.equal(await worker.evaluate(()=>chrome.storage.local.get('address').then(s=>s.address)),'http://tm.example:8080');
 const opened=context.waitForEvent('page');await page.locator('#venueOpen').click();const venue=await opened;await venue.waitForLoadState();assert.equal(new URL(venue.url()).origin,address);
 await page.locator('#venueRemove').click();await page.getByText('Venue address forgotten.').waitFor();assert.equal(await page.locator('#venueOpen').isDisabled(),true);
 assert.equal(await worker.evaluate(()=>chrome.storage.local.get('venueAddress').then(s=>s.venueAddress)),undefined);
 }finally{await context?.close();await new Promise(r=>server.close(r));}
});
