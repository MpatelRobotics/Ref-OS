import test from 'node:test';
import assert from 'node:assert/strict';
import { _electron as electron } from '@playwright/test';

test('blank website returns to setup and backup address opens the app', {timeout:35000}, async()=>{
 const app=await electron.launch({...(process.env.REFOS_PACKAGED_EXE?{executablePath:process.env.REFOS_PACKAGED_EXE,args:[]}:{args:['desktop/build/main.mjs']}),env:{...process.env,REFOS_DESKTOP_TEST:'1'}});
 try {
  const page=await app.firstWindow(); await page.waitForLoadState('domcontentloaded');
  await page.route('https://www.ref-os.fyi/**',r=>r.fulfill({contentType:'text/html',body:'<html><body><div id="root"></div></body></html>'}));
  await page.route('https://ref-os.vercel.app/**',r=>r.fulfill({contentType:'text/html',body:'<h1>Ref OS backup</h1>'}));
  await page.getByLabel('Ref OS website address').fill('https://www.ref-os.fyi/');
  await page.getByRole('button',{name:'Open Ref OS',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('ERR_APP_NOT_READY'),{},{timeout:25000});
  assert.match(await page.locator('#status').innerText(),/did not finish loading/);
  await page.getByRole('button',{name:'Use Ref OS backup address',exact:true}).click();
  await page.waitForURL('https://ref-os.vercel.app/');
  assert.equal(await page.locator('h1').innerText(),'Ref OS backup');
  assert.equal(await page.evaluate(()=>typeof window.refosTmDesktop.request),'function');
 } finally {await app.close();}
});
