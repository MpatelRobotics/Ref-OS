
import {test,expect} from '@playwright/test';
async function mount(page,component='settings'){
 await page.route('**/merged-settings-test',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">import '/src/index.css';import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const settings=${component==='settings'};const View=(await import(settings?'/src/components/modals/EventSettingsModal.jsx':'/src/components/CommandCenter.jsx')).default;DOM.createRoot(document.getElementById('root')).render(React.createElement(View,settings?{event:{name:'Test Event',quals:48,practice:0,bracket:16,finalsBestOf:3},brand:{shortName:'Test'},eventTimezone:'UTC',onSave:async value=>{window.saved=value;},onClose:()=>{}}:{matches:{},viols:[],fieldLog:[],presence:[],roster:[],onEventSettings:()=>window.opened=true}));</script>`}));
 await page.goto('/merged-settings-test');
}
test('combined form saves match setup and timezone together on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await mount(page);
 await expect(page.getByRole('heading',{name:'Event Setup & Settings'})).toBeVisible();
 await page.getByLabel('Number of qualification matches',{exact:true}).fill('64');
 await page.getByLabel('Event timezone',{exact:true}).selectOption('America/Denver');
 await page.getByRole('combobox',{name:'Elimination bracket',exact:true}).selectOption('8');
 await page.getByRole('button',{name:'Save Settings',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.saved?.setup?.quals)).toBe(64);
 expect(await page.evaluate(()=>({timezone:window.saved.timezone,bracket:window.saved.setup.bracket,name:window.saved.name}))).toEqual({timezone:'America/Denver',bracket:8,name:null});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('IQ hides elimination controls and saves partner finals setup',async({page})=>{
 await mount(page);await page.getByRole('radio',{name:/VEX IQ/}).check();
 await expect(page.getByRole('combobox',{name:'Elimination bracket',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Save Settings',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.saved?.setup?.competitionProgram)).toBe('iq');
 expect(await page.evaluate(()=>[window.saved.setup.bracket,window.saved.setup.finalsBestOf])).toEqual([0,1]);
});
test('command center has one combined settings entry',async({page})=>{
 await mount(page,'command');
 await expect(page.getByRole('button',{name:'Event Setup',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Event Settings',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Event Setup & Settings',exact:true}).click();
 expect(await page.evaluate(()=>window.opened)).toBe(true);
});
