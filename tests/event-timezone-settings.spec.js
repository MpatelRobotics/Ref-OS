import {test,expect} from '@playwright/test';
async function mount(page,zone='UTC'){
 await page.route('**/timezone-test',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">import '/src/index.css';import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,View=(await import('/src/components/modals/EventSettingsModal.jsx')).default;DOM.createRoot(document.getElementById('root')).render(React.createElement(View,{event:{name:'Event'},brand:{shortName:'Event'},eventTimezone:${JSON.stringify(zone)},onSave:async value=>window.savedSettings=value,onClose:()=>{}}));</script>`}));
 await page.goto('/timezone-test');
}
test('event settings saves a timezone-only change',async({page})=>{
 await mount(page);await page.getByLabel('Search timezone countries',{exact:true}).fill('United States');await page.getByLabel('Timezone country',{exact:true}).selectOption('US');await page.getByLabel('Event timezone',{exact:true}).selectOption('America/New_York');await page.getByRole('button',{name:'Save Settings',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.savedSettings?.timezone)).toBe('America/New_York');expect(await page.evaluate(()=>window.savedSettings.name)).toBe(null);
});
test('international timezone country filters zones and saves India without US zones',async({page})=>{
 await page.setViewportSize({width:390,height:844});await mount(page);
 await page.getByLabel('Search timezone countries',{exact:true}).fill('India');await page.getByLabel('Timezone country',{exact:true}).selectOption('IN');
 await expect(page.getByLabel('Event timezone',{exact:true}).locator('option[value="America/New_York"]')).toHaveCount(0);
 await page.getByLabel('Search timezones',{exact:true}).fill('Kolkata');await page.getByLabel('Event timezone',{exact:true}).selectOption('Asia/Kolkata');
 await page.getByRole('button',{name:'Save Settings',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.savedSettings?.timezone)).toBe('Asia/Kolkata');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('existing alias is retained and a zone shared by countries stays in the selected country',async({page})=>{
 await mount(page,'Asia/Calcutta');await expect(page.getByLabel('Timezone country',{exact:true})).toHaveValue('IN');await expect(page.getByLabel('Event timezone',{exact:true})).toHaveValue('Asia/Calcutta');
 await page.getByLabel('Timezone country',{exact:true}).selectOption('DK');await page.getByLabel('Event timezone',{exact:true}).selectOption('Europe/Berlin');await expect(page.getByLabel('Timezone country',{exact:true})).toHaveValue('DK');
});
