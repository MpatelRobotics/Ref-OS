import test from 'node:test';
import assert from 'node:assert/strict';
import {_electron as electron} from '@playwright/test';
test('Judging Portal is an independent secure app that opens its own cloud workspace',{timeout:45000},async()=>{
 const desktop=await electron.launch({...(process.env.REFOS_JUDGING_PACKAGED_EXE?{executablePath:process.env.REFOS_JUDGING_PACKAGED_EXE,args:[]}:{args:['judging-desktop/main.mjs']}),env:{...process.env,REFOS_JUDGING_TEST:'1'}});
 try{
  const page=await desktop.firstWindow();
  await page.route('https://www.ref-os.fyi/**',r=>r.fulfill({contentType:'text/html',body:'<title>Other title</title><h1>Judging workspace</h1>'}));
  await page.reload();await page.getByRole('heading',{name:'Judging workspace'}).waitFor();
  assert.equal(page.url(),'https://www.ref-os.fyi/?app=judging');
  assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getTitle()),'Ref-OS Judging Portal');
  assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
  assert.equal(await page.evaluate(()=>typeof window.refosTmDesktop),'undefined');
  const prefs=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.sandbox,true);assert.equal(prefs.webSecurity,true);
 }finally{await desktop.close();}
});
