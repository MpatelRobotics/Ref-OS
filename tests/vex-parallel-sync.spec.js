import {test,expect} from '@playwright/test';
test('Sync everything starts all categories with one division and polls every 15 seconds',async({page})=>{
 await page.clock.install();
 await page.route('**/all-sync-test',r=>r.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
 import '/@vite/client';import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default;const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const Manager=(await import('/src/components/VexSyncManager.jsx')).default;await import('/src/index.css');
 window.applied=[];window.requests=[];window.failSkills=false;
 function Harness(){const [open,setOpen]=React.useState(null),[setup,setSetup]=React.useState(true),[status,setStatus]=React.useState(true);window.showSyncStatus=setStatus;return React.createElement(Manager,{showLaunch:false,setupOpen:setup,onSetupClose:()=>setSetup(false),showStatus:status,visible:{rankings:open==='rankings',skills:open==='skills',scores:open==='scores'},onOpen:setOpen,onClose:()=>setOpen(null),initialCode:'VE-V5-26-65633',target:'Test event',onSaveCode:async code=>{window.saved=code;},onFetch:async(code,division,kind)=>{window.requests.push({code,division,kind});if(kind==='skills'&&window.failSkills)throw Error('Skills unavailable');return {divisions:[{id:1,name:'Main'},{id:2,name:'Other'}],rankings:[{number:'2A',rank:window.requests.length}],skills:[{number:'2A',total:window.requests.length}],scores:[{phase:'qual',num:1,redScore:133,blueScore:0}]};},onApply:async(data,kind)=>{window.applied.push(kind);return {message:kind+' updated'};}});}DOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
 </script></body></html>`}));
 await page.goto('/all-sync-test');await expect(page.getByRole('button',{name:'Sync everything',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Start all syncs'})).toBeDisabled();
 await page.getByRole('button',{name:'Load divisions'}).click();await page.getByRole('combobox').selectOption('2');
 await page.getByRole('button',{name:'Start all syncs'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(await page.evaluate(()=>window.applied)).toEqual(['rankings','skills','scores']);
 expect(await page.evaluate(()=>window.requests.slice(1).map(r=>r.division))).toEqual([2,null,2]);
 await page.clock.fastForward(15000);await expect.poll(()=>page.evaluate(()=>window.applied?.length || 0)).toBe(6);
 await expect(page.getByLabel('VEX scores sync status')).toContainText('scores updated');
 await expect(page.getByLabel('VEX scores sync status').locator('details p')).toBeHidden();
 await page.getByLabel('VEX scores sync status').getByText('Details',{exact:true}).click();
 await expect(page.getByLabel('VEX scores sync status').locator('details p')).toBeVisible();
 await page.evaluate(()=>{window.failSkills=true;});await page.clock.fastForward(15000);
 await expect.poll(()=>page.evaluate(()=>window.applied?.length || 0)).toBe(8);
 await expect(page.getByLabel('VEX Skills sync status')).toContainText('Skills unavailable');
 await expect(page.getByLabel('VEX sync status',{exact:true})).toContainText('sync active');
 await expect(page.getByLabel('VEX scores sync status')).toContainText('sync active');
 await page.evaluate(()=>window.showSyncStatus(false));
 await expect(page.getByLabel('VEX scores sync status')).toHaveCount(0);
 const before=await page.evaluate(()=>window.applied?.length || 0);
 await page.clock.fastForward(15000);
 await expect.poll(()=>page.evaluate(()=>window.applied?.length || 0)).toBe(before+2);
});
test('all three syncs stay active and stopping Skills preserves rankings and scores',async({page})=>{
 await page.clock.install();
 await page.route('**/parallel-sync-test',r=>r.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">import '/@vite/client';import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default;const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const Manager=(await import('/src/components/VexSyncManager.jsx')).default;await import('/src/index.css');window.applied=[];window.fetches=[];window.inFlight=0;window.maxFlight=0;function Harness(){const [open,setOpen]=React.useState(null);return React.createElement(React.Fragment,null,...['rankings','skills','scores'].map(k=>React.createElement('button',{key:k,onClick:()=>setOpen(k)},'Open '+k)),React.createElement(Manager,{visible:{rankings:open==='rankings',skills:open==='skills',scores:open==='scores'},onOpen:setOpen,onClose:()=>setOpen(null),initialCode:'VE-V5-27-6588',target:'Event One',onFetch:async(code,division,kind)=>{window.inFlight++;window.maxFlight=Math.max(window.maxFlight,window.inFlight);await Promise.resolve();window.inFlight--;window.fetches.push(kind);return {divisions:[{id:1,name:'Main'}],rankings:[{number:'2A',rank:window.fetches.length}],skills:[{number:'2A',total:window.fetches.length}],scores:[{phase:'qual',num:1,redScore:window.fetches.length,blueScore:0}]};},onApply:async(data,kind)=>{window.applied.push(kind);}}));}DOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));</script></body></html>`}));
 await page.goto('/parallel-sync-test');
 for(const kind of ['rankings','skills','scores']){await page.getByRole('button',{name:'Open '+kind,exact:true}).click();await expect(page.getByRole('button',{name:'Start syncing',exact:true})).toBeVisible();await page.getByRole('button',{name:'Start syncing',exact:true}).click();}
 await expect(page.getByLabel('VEX sync status', {exact:true})).toContainText('sync active');await expect(page.getByLabel('VEX Skills sync status')).toContainText('sync active');await expect(page.getByLabel('VEX scores sync status')).toContainText('sync active');
 await page.clock.fastForward(15000);await expect.poll(()=>page.evaluate(()=>window.applied?.length || 0)).toBe(6);expect(await page.evaluate(()=>window.maxFlight)).toBe(1);
 await page.getByLabel('VEX Skills sync status').getByRole('button',{name:'Stop sync',exact:true}).click();const before=await page.evaluate(()=>window.applied?.length || 0);await page.clock.fastForward(15000);await expect.poll(()=>page.evaluate(()=>window.applied?.length || 0)).toBe(before+2);await expect(page.getByLabel('VEX sync status',{exact:true})).toContainText('sync active');await expect(page.getByLabel('VEX scores sync status')).toContainText('sync active');
});

test('opening an event automatically starts saved-division sync without TM or a dialog',async({page})=>{
 await page.clock.install();
 await page.route('**/auto-sync-test',r=>r.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
 import '/@vite/client';import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default;const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const Manager=(await import('/src/components/VexSyncManager.jsx')).default;await import('/src/index.css');
 window.applied=[];window.requests=[];window.failSkills=false;
 function Harness(){const [open,setOpen]=React.useState(null),[setup,setSetup]=React.useState(false),[status,setStatus]=React.useState(true);window.showSyncStatus=setStatus;return React.createElement(Manager,{autoStart:true,initialDivision:2,showLaunch:false,setupOpen:setup,onSetupClose:()=>setSetup(false),showStatus:status,visible:{rankings:open==='rankings',skills:open==='skills',scores:open==='scores'},onOpen:setOpen,onClose:()=>setOpen(null),initialCode:'VE-V5-26-65633',target:'Test event',onSaveCode:async code=>{window.saved=code;},onFetch:async(code,division,kind)=>{window.requests.push({code,division,kind});if(kind==='skills'&&window.failSkills)throw Error('Skills unavailable');return {divisions:[{id:1,name:'Main'},{id:2,name:'Other'}],rankings:[{number:'2A',rank:window.requests.length}],skills:[{number:'2A',total:window.requests.length}],scores:[{phase:'qual',num:1,redScore:133,blueScore:0}]};},onApply:async(data,kind)=>{window.applied.push(kind);return {message:kind+' updated'};}});}DOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
 </script></body></html>`}));
 await page.goto('/auto-sync-test');
 await expect.poll(()=>page.evaluate(()=>window.applied?.length || 0)).toBe(5);
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Sync everything',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>window.requests.slice(1).map(r=>r.division))).toEqual([1,2,null,1,2]);
 await page.evaluate(()=>window.showSyncStatus(false));
 await page.clock.fastForward(15000);
 await expect.poll(()=>page.evaluate(()=>window.applied?.length || 0)).toBe(10);
});
