import {test,expect} from '@playwright/test';
async function open(page, mode='pending') {
 await page.route('**/initial-admin-test',route=>route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">
 import '/src/index.css';import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,Gate=(await import('/src/auth/InitialAdminSetup.jsx')).default;
 window.saved=[];window.unlocked=0;let checks=0;const mode='${mode}';const accessApi={eventRequiresAdminSetup:async()=>{if(mode==='error')throw Error('offline');return mode!=='normal' && !(mode==='race' && checks++>0);},completeInitialAdminSetup:async(id,code)=>{if(mode==='race')throw Error('Admin setup is already complete. Sign in with the event code.');window.saved.push({id,code});}};
 DOM.createRoot(document.getElementById('root')).render(React.createElement(Gate,{eventId:'test-event',accessApi,onUnlock:()=>window.unlocked++,onChooseEvent:()=>{}},React.createElement('div',null,'Regular event login')));
 </script>`})); await page.goto('/initial-admin-test');
}
test('pending event requires matching admin codes before unlock',async({page})=>{
 await open(page);await expect(page.getByRole('heading',{name:'Create an admin code'})).toBeVisible();await expect(page.getByText('Regular event login')).toHaveCount(0);
 await page.getByLabel('New admin code').fill('3S23');await page.getByLabel('Confirm admin code').fill('4T24');await page.getByRole('button',{name:'Create code and enter event'}).click();await expect(page.getByRole('alert')).toHaveText('The admin codes do not match.');expect(await page.evaluate(()=>window.unlocked)).toBe(0);
 await page.getByLabel('Confirm admin code').fill('3S23');await page.getByRole('button',{name:'Create code and enter event'}).click();await expect.poll(()=>page.evaluate(()=>window.unlocked)).toBe(1);expect(await page.evaluate(()=>window.saved)).toEqual([{id:'test-event',code:'3S23'}]);
});
test('existing events use regular login',async({page})=>{await open(page,'normal');await expect(page.getByText('Regular event login')).toBeVisible();});
test('failed setup check stays closed',async({page})=>{await open(page,'error');await expect(page.getByRole('alert')).toContainText('Could not check');await expect(page.getByText('Regular event login')).toHaveCount(0);expect(await page.evaluate(()=>window.unlocked)).toBe(0);});
test('concurrent setup loser returns to login without unlocking',async({page})=>{await open(page,'race');await page.getByLabel('New admin code').fill('3S23');await page.getByLabel('Confirm admin code').fill('3S23');await page.getByRole('button',{name:'Create code and enter event'}).click();await expect(page.getByText('Regular event login')).toBeVisible();expect(await page.evaluate(()=>window.unlocked)).toBe(0);});
