import { test, expect } from '@playwright/test';
async function mount(page){
 await page.route(/\/src\/api(?:\.js)?(?:\?.*)?$/,async route=>{const response=await route.fetch();const source=await response.text();await route.fulfill({response,body:source.replace('export async function claimEventAccess(eventId, credential) {',`export async function claimEventAccess(eventId, credential) { window.attempts=(window.attempts||[]).concat(credential);if(credential!=='1A23')throw Error('Invalid event credential');return {role:'ref',isAdmin:false,serverRole:'ref'};`)});});
 await page.route('**/event-passkey-test',route=>route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default;const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const View=(await import('/src/auth/LoginScreen.jsx')).default;window.testAccess={role:'admin',developer:false};window.logins=[];DOM.createRoot(document.getElementById('root')).render(React.createElement(View,{eventId:'event-two',eventName:'Event Two',onUnlock:(...args)=>window.logins.push(args),onChooseEvent:()=>{}}));</script>`}));
 await page.goto('/event-passkey-test');await expect(page.getByRole('textbox',{name:'Event access code',exact:true})).toBeVisible();
}
test('fourth code character automatically verifies once; incorrect code can be retried', async ({page}) => {
 await mount(page);

 for (const key of '1A24') await page.getByRole('button',{name:key,exact:true}).click();
 await expect(page.getByText('Incorrect event credential.')).toBeVisible();
 expect(await page.evaluate(()=>window.logins)).toEqual([]);
 for (const key of '1A23') await page.getByRole('button',{name:key,exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.logins.length)).toBe(1);
 expect(await page.evaluate(()=>window.attempts)).toEqual(['1A24','1A23']);
});

test('keyboard typing accepts lowercase letters and automatically submits the complete code once',async({page})=>{
 await mount(page);await page.getByRole('textbox',{name:'Event access code',exact:true}).pressSequentially('1a23');
 await expect.poll(()=>page.evaluate(()=>window.logins.length)).toBe(1);
 expect(await page.evaluate(()=>window.attempts)).toEqual(['1A23']);
});
test('typing continues after keypad focus and backspace edits the code',async({page})=>{
 await mount(page);await page.getByRole('button',{name:'1',exact:true}).click();await page.keyboard.type('a2');await page.keyboard.press('Backspace');await page.keyboard.type('23');
 await expect.poll(()=>page.evaluate(()=>window.logins.length)).toBe(1);expect(await page.evaluate(()=>window.attempts)).toEqual(['1A23']);
});
test('pasted code verifies without requiring keypad clicks',async({page})=>{
 await mount(page);
 await page.getByRole('textbox',{name:'Event access code',exact:true}).evaluate(input=>{const data=new DataTransfer();data.setData('text','1a23');input.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});
 await expect.poll(()=>page.evaluate(()=>window.logins.length)).toBe(1);expect(await page.evaluate(()=>window.attempts)).toEqual(['1A23']);
});
