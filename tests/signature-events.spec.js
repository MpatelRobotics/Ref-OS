import {test,expect} from '@playwright/test';
async function mount(page,isDeveloper=false,signatureEvent=false){
 await page.route('**/division-setup-test',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">import '/src/index.css';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,View=(await import('/src/components/modals/EventSettingsModal.jsx')).default;DOM.createRoot(document.getElementById('root')).render(React.createElement(View,{isDeveloper:${isDeveloper},signatureEvent:${signatureEvent},event:{name:'Slugger Signature Event High School - '+ 'Louisville '.repeat(10)},brand:{shortName:'Slugger Signature Event High School Division Staff'},divisionId:1,divisions:[{id:1,name:'Division 1'},{id:2,name:'Division 2'}],onSave:async value=>window.savedSettings=value,onClose:()=>{}}));</script>`}));
 await page.goto('/division-setup-test');
}
test('only developers see the signature switch and can mark or unmark the event',async({page})=>{
 await mount(page,false);
 await expect(page.getByRole('checkbox',{name:/Signature Event/})).toHaveCount(0);
 await mount(page,true);
 await page.getByRole('checkbox',{name:/Signature Event/}).check();
 await page.getByRole('button',{name:'Save Settings',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.savedSettings?.signatureEvent)).toBe(true);
 await mount(page,true,true);
 await page.getByRole('checkbox',{name:/Signature Event/}).uncheck();
 await page.getByRole('button',{name:'Save Settings',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.savedSettings?.signatureEvent)).toBe(false);
});
