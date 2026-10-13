import {test,expect} from '@playwright/test';
async function mount(page,denied=false){
 await page.route('**/access-manager-test',route=>route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default;const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const View=(await import('/src/components/DeveloperAccessManager.jsx')).default;await import('/src/index.css');window.calls=[];window.locked=false;const data={passkeys:[{id:'key',label:'Passkey',created_at:'2026-10-13T12:00:00Z',last_used_at:null}],devices:[{userId:'device-other',name:'Other phone',current:false,events:[{name:'League',role:'Developer'}],activity:[]},{userId:'device-self',name:'My laptop',current:true,events:[{name:'League',role:'Developer'}],activity:[]}]};const invoke=async(action,value)=>{window.calls.push([action,value]);if(${denied})throw Object.assign(Error('Developer access ended'),{denied:true});if(action==='manage-list')return structuredClone(data);if(action==='manage-rename')data.passkeys[0].label=value.label;if(action==='manage-revoke')data.passkeys=[];if(action==='manage-logout'){data.devices=data.devices.filter(d=>d.userId!==value.userId);return {self:value.userId==='device-self'};}return {ok:true};};DOM.createRoot(document.getElementById('root')).render(React.createElement(View,{invoke,onLock:()=>window.locked=true}));</script>`}));
 await page.goto('/access-manager-test');
}
test('Developer can rename and revoke passkeys and log out another or current device',async({page})=>{
 await mount(page);page.on('dialog',dialog=>dialog.accept());
 await page.getByText('Passkey manager',{exact:true}).click();
 await page.getByRole('button',{name:'Rename',exact:true}).click();await page.getByLabel('Passkey name').fill('Windows laptop');await page.getByRole('button',{name:'Save name'}).click();await expect(page.getByRole('heading',{name:'Windows laptop'})).toBeVisible();
 await page.getByRole('button',{name:'Revoke passkey'}).click();await expect(page.getByText('No active passkeys registered.')).toBeVisible();
 await page.getByText('Signed-in devices',{exact:true}).click();await page.getByRole('button',{name:'Log out',exact:true}).click();await expect(page.getByRole('heading',{name:'Other phone'})).toHaveCount(0);await page.getByRole('button',{name:'Log out this device'}).click();await expect.poll(()=>page.evaluate(()=>window.locked)).toBe(true);
});
test('revoked Developer access returns management page to the lock',async({page})=>{
 await mount(page,true);await expect.poll(()=>page.evaluate(()=>window.locked)).toBe(true);
 await expect(page.getByRole('alert')).toContainText('Developer access ended');
});
