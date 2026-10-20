import { test, expect } from '@playwright/test';
test('fourth code character automatically verifies once; incorrect code can be retried', async ({page}) => {
 await page.route(/\/src\/api(?:\.js)?(?:\?.*)?$/,async route=>{const response=await route.fetch();const source=await response.text();await route.fulfill({response,body:source.replace('export async function claimEventAccess(eventId, credential) {',`export async function claimEventAccess(eventId, credential) { window.attempts=(window.attempts||[]).concat(credential);if(credential!=='1A23')throw Error('Invalid event credential');return {role:'ref',isAdmin:false,serverRole:'ref'};`)});});
 await page.route('**/event-passkey-test',route=>route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default;const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const View=(await import('/src/auth/LoginScreen.jsx')).default;window.testAccess={role:'admin',developer:false};window.logins=[];DOM.createRoot(document.getElementById('root')).render(React.createElement(View,{eventId:'event-two',eventName:'Event Two',onUnlock:(...args)=>window.logins.push(args),onChooseEvent:()=>{}}));</script>`}));
 await page.goto('/event-passkey-test');

 for (const key of '1A24') await page.getByRole('button',{name:key,exact:true}).click();
 await expect(page.getByText('Incorrect event credential.')).toBeVisible();
 expect(await page.evaluate(()=>window.logins)).toEqual([]);
 for (const key of '1A23') await page.getByRole('button',{name:key,exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.logins.length)).toBe(1);
 expect(await page.evaluate(()=>window.attempts)).toEqual(['1A24','1A23']);
});
