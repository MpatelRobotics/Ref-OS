import { test, expect } from '@playwright/test';

async function mount(page, desktop = true, mobile = false, mapping = false) {
  if (mobile) await page.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true }; });
  if (desktop) await page.addInitScript(() => { window.refosTmDesktop = { setSyncActive: async active => { window.desktopActive = active; } }; });
  await page.route('**/tm-sync-test', route => route.fulfill({ contentType: 'text/html', body: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
  import '/src/index.css';
  const React=(await import('/node_modules/.vite/deps/react.js')).default;
  const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
  const RefreshRuntime=(await import('/@react-refresh')).default;RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
  const Component=(await import('/src/components/TmApiSync.jsx')).default;
  const Fields=(await import('/src/components/TmFieldActivity.jsx')).default;
  window.reads=0;window.applies=[];window.fail=false;
  const snapshot={event:{name:'ButterNova',code:'VE-V5-26-65633'},divisions:[{id:1,name:'Division 1'}],teams:[{number:'32092X',name:'Team X'}],rankings:[{rank:1,alliance:{teams:[{number:'32092X'}]}}],skills:[{rank:1,number:'1082C',totalScore:10,driverHighScore:0,progHighScore:10}],matches:[{finalScore:[133,0],matchInfo:{state:'SCORED',matchTuple:{session:0,division:1,round:'QUAL',instance:1,match:1},alliances:[{teams:[{number:'32092X'},{number:'32092G'}]},{teams:[{number:'13713A'},{number:'32092H'}]}]}}]};
  window.fieldData={fieldSets:[{id:1,name:'Set 1',connected:true,fields:[{id:1,name:'Yellow Field',status:'playing',active:true,match:{division:1,session:0,round:'QUAL',match:2,instance:1}}]}]};window.published=[];window.disconnected=0;
  function Harness(){const [open,setOpen]=React.useState(true),[activity,setActivity]=React.useState(null);return React.createElement(React.Fragment,null,React.createElement('button',{onClick:()=>setOpen(true)},'Manage TM'),React.createElement(Fields,{value:activity}),React.createElement(Component,{open,onClose:()=>setOpen(false),target:'ButterNova · Session 1',refosDivisions:${mapping ? JSON.stringify([{id:99,name:'Division 1'}]) : '[]'},refosDivisionId:${mapping ? 99 : 0},onSaveDivisionMapping:async(id,name)=>{window.savedMapping={id,name};},expectedCode:'VE-V5-26-65633',onFetch:async settings=>{window.reads++;window.lastFetchSettings=settings;if(window.eliminations && !snapshot.matches.some(m=>m.matchInfo.matchTuple.round==='QF'))snapshot.matches.push({...snapshot.matches[0],matchInfo:{...snapshot.matches[0].matchInfo,matchTuple:{session:0,division:1,round:'QF',instance:2,match:1}}});if(window.fail)throw Error('Event administrator access is required.');return {...snapshot,connectionId:settings.liveFields?'live-id':'',event:{...snapshot.event,code:window.mismatch?'WRONG':snapshot.event.code}};},onActivity:async()=>window.fieldData,onDisconnect:async()=>{window.disconnected++;},onPublishActivity:async(value)=>{window.published.push(value);setActivity(value);},onApply:async(data,options)=>{window.applies.push({data,includeSchedule:options.includeSchedule});return '1 scores updated';}}));}
  DOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  </script></body></html>` }));
  await page.goto('/tm-sync-test');
}
async function review(page) {
  await page.getByLabel('Event TM API key',{exact:true}).fill('event-key');
  await page.getByRole('button',{name:'Connect to TM',exact:true}).click();
  await page.getByRole('button',{name:'Review TM data',exact:true}).click();
}
test('preview maps skills and scored zeros, closes on start, polls every 30 seconds and stops independently',async({page})=>{
  await mount(page);await page.clock.install();await review(page);
  await expect(page.getByText('1 teams · 1 matches · 1 scored matches · 1 rankings · 1 skills results')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.evaluate(() => { window.fieldData = {fieldSets:[]}; });
  await page.getByRole('button',{name:'Start TM syncing'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>window.applies.length)).toBe(1);
  const imported=await page.evaluate(()=>window.applies[0]);expect(imported.data.scores[0].blueScore).toBe(0);expect(imported.includeSchedule).toBe(true);
  expect(await page.evaluate(()=>window.lastFetchSettings.liveFields)).toBe(true);
  await page.clock.runFor(29000);expect(await page.evaluate(()=>window.reads)).toBe(3);
  await page.clock.runFor(1100);await expect.poll(()=>page.evaluate(()=>window.reads)).toBe(4);
  await page.getByRole('button',{name:'Stop TM sync',exact:true}).click();
  await page.clock.runFor(61000);expect(await page.evaluate(()=>window.reads)).toBe(4);
});
test('wrong event is blocked and connection errors have a recoverable message',async({page})=>{
  await mount(page);await page.evaluate(()=>window.mismatch=true);await review(page);
  await expect(page.getByRole('alert')).toContainText('differs');await expect(page.getByRole('button',{name:'Start TM syncing'})).toBeDisabled();
  await page.evaluate(()=>{window.mismatch=false;window.fail=true;});await page.getByRole('button',{name:'Connect to TM',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('administrator access');
  await page.evaluate(()=>window.fail=false);await page.getByRole('button',{name:'Connect to TM',exact:true}).click();await page.getByRole('button',{name:'Review TM data'}).click();
  await expect(page.getByRole('button',{name:'Start TM syncing'})).toBeEnabled();
});
test('setup download and controls fit mobile and key stays password masked',async({page})=>{
  await mount(page, false);
  await expect(page.getByRole('link',{name:'Download Ref OS TM Connect for Windows'})).toHaveAttribute('href','https://github.com/MpatelRobotics/Ref-OS/releases/download/tm-connect/Ref-OS-TM-Connect.exe');
  await expect(page.getByLabel('Event TM API key',{exact:true})).toHaveAttribute('type','password');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Start TM syncing'}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'Start TM syncing'})).toBeVisible();
});
test('live events publish Playing now and Stopped, and disconnect when sync stops',async({page})=>{
  await mount(page);await page.clock.install();await review(page);
  await page.getByRole('button',{name:'Start TM syncing'}).click();
  await page.getByLabel('Live TM fields',{exact:true}).locator('summary').click();
  await expect(page.getByText('Qualifier #2 · Playing now',{exact:true})).toBeVisible();
  await page.evaluate(()=>window.fieldData.fieldSets[0].fields[0].status='stopped');
  await page.clock.runFor(1100);await expect(page.getByText('Qualifier #2 · Stopped',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Stop TM sync',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.disconnected)).toBe(1);
  await expect(page.getByText('Qualifier #2 · Connection unavailable',{exact:true})).toBeVisible();
  const count=await page.evaluate(()=>window.published.length);await page.clock.runFor(91000);
  expect(await page.evaluate(()=>window.published.length)).toBe(count);
  await expect(page.getByText('Live updates unavailable. Showing last observed field activity.')).toBeVisible();
});

 test('desktop keeps polling with its document hidden and reports active state', async ({page}) => {
  await mount(page); await page.clock.install(); await review(page);
  await page.evaluate(() => { window.fieldData.fieldSets[0].fields[0].status = 'queued'; });
  await page.getByRole('button',{name:'Start TM syncing'}).click();
  await expect.poll(() => page.evaluate(() => window.desktopActive)).toBe(true);
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable:true, value:true }));
  const reads = await page.evaluate(() => window.reads);
  await page.clock.runFor(30100);
  await expect.poll(() => page.evaluate(() => window.reads)).toBe(reads + 1);
  await page.getByRole('button',{name:'Stop TM sync',exact:true}).click();
  await expect.poll(() => page.evaluate(() => window.desktopActive)).toBe(false);
 });

test('match start triggers one score refresh after 30 seconds and stop cancels pending refresh', async ({page}) => {
  await mount(page); await page.clock.install(); await review(page);
  await page.evaluate(() => { window.fieldData.fieldSets[0].fields[0].status = 'queued'; });
  await page.getByRole('button',{name:'Start TM syncing'}).click();
  const reads = await page.evaluate(() => window.reads);
  await page.evaluate(() => { window.fieldData.fieldSets[0].fields[0].status = 'playing'; });
  await page.clock.runFor(1000);
  await page.clock.runFor(28000);
  expect(await page.evaluate(() => window.reads)).toBe(reads);
  await page.clock.runFor(2100);
  await expect.poll(() => page.evaluate(() => window.reads)).toBe(reads + 2);
  await page.evaluate(() => { window.fieldData.fieldSets[0].fields[0].match.match = 3; });
  await page.clock.runFor(1000);
  await page.getByRole('button',{name:'Stop TM sync',exact:true}).click();
  await page.clock.runFor(31000);
  expect(await page.evaluate(() => window.reads)).toBe(reads + 2);
});

 test('native mobile connects with IP and key, hides desktop download, and pauses polling while hidden', async ({page}) => {
  await mount(page, false, true); await page.clock.install();
  await expect(page.getByRole('link',{name:'Download Ref OS TM Connect for Windows'})).toHaveCount(0);
  await expect(page.getByText('Connect this device to the event Wi-Fi, then enter the TM address and event key.',{exact:false})).toBeVisible();
  await page.getByLabel('TM server address',{exact:true}).fill('192.168.0.164');
  await review(page);
  await page.evaluate(() => { window.fieldData = {fieldSets:[]}; });
  await page.getByRole('button',{name:'Start TM syncing'}).click();
  const reads = await page.evaluate(() => window.reads);
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable:true, value:true }));
  await page.clock.runFor(61000); expect(await page.evaluate(() => window.reads)).toBe(reads);
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable:true, value:false }));
  await page.clock.runFor(30000); await expect.poll(() => page.evaluate(() => window.reads)).toBe(reads+1);
 });


test('elimination schedule switches to fresh score sync every 15 seconds', async ({page}) => {
  await mount(page); await page.clock.install(); await review(page);
  await page.evaluate(() => { window.fieldData = {fieldSets:[]}; });
  await page.getByRole('button',{name:'Start TM syncing'}).click();
  await expect(page.getByRole('status')).toContainText('every 30 seconds');
  await page.evaluate(() => { window.eliminations = true; });
  await page.clock.runFor(30100);
  await expect(page.getByRole('status')).toContainText('every 15 seconds');
  const reads = await page.evaluate(() => window.reads);
  await page.clock.runFor(14000);
  expect(await page.evaluate(() => window.reads)).toBe(reads);
  await page.clock.runFor(1100);
  await expect.poll(() => page.evaluate(() => window.reads)).toBe(reads + 1);
  expect(await page.evaluate(() => window.lastFetchSettings.forceScores)).toBe(true);
  await page.clock.runFor(15100);
  await expect.poll(() => page.evaluate(() => window.reads)).toBe(reads + 2);
  await page.getByRole('button',{name:'Stop TM sync',exact:true}).click();
  await page.clock.runFor(15100);
  expect(await page.evaluate(() => window.reads)).toBe(reads + 2);
});

test('setup matches division names despite different Ref OS IDs and remembers the reviewed mapping',async({page})=>{
 await mount(page,true,false,true);await review(page);
 expect(await page.evaluate(()=>window.lastFetchSettings.division)).toBe(1);
 expect(await page.evaluate(()=>window.savedMapping)).toEqual({id:1,name:'Division 1'});
 await expect(page.getByRole('combobox',{name:'TM division',exact:true})).toHaveValue('1');
});
