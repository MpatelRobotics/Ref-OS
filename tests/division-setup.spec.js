import {test,expect} from '@playwright/test';
async function mount(page){
 await page.route('**/division-setup-test',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">import '/src/index.css';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,View=(await import('/src/components/modals/EventSettingsModal.jsx')).default;DOM.createRoot(document.getElementById('root')).render(React.createElement(View,{event:{name:'Slugger'},brand:{shortName:'Slugger'},divisionId:1,divisions:[{id:1,name:'Division 1'},{id:2,name:'Division 2'}],onSave:async value=>window.savedSettings=value,onClose:()=>{}}));</script>`}));
 await page.goto('/division-setup-test');
}
test('configure separate division names and fields, preserve drafts while switching, save only division changes',async({page})=>{
 await page.setViewportSize({width:390,height:844});await mount(page);
 await page.getByLabel('Division name',{exact:true}).fill('University of Louisville Speed School Division');
 await page.getByLabel('Field 1 name',{exact:true}).fill('TechBridge Field');
 await page.getByLabel('Division to configure').selectOption('2');
 await page.getByLabel('Division name',{exact:true}).fill('Tech Bridge Division');
 await page.getByLabel('Field 1 name',{exact:true}).fill('Nucor Field');
 await page.getByLabel('Division to configure').selectOption('1');
 await expect(page.getByLabel('Field 1 name',{exact:true})).toHaveValue('TechBridge Field');
 await page.getByRole('button',{name:'Save Settings',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.savedSettings?.divisions?.length)).toBe(2);
 const saved=await page.evaluate(()=>window.savedSettings);
 expect(saved.divisions.map(row=>row.fieldNames['Field 1'])).toEqual(['TechBridge Field','Nucor Field']);
 expect(saved.setup).toBeNull();expect(saved.fieldNames).toBeNull();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('add a division and reject duplicate field names without submitting',async({page})=>{
 await mount(page);await page.getByRole('button',{name:'Add division',exact:true}).click();
 await expect(page.getByLabel('Division name',{exact:true})).toHaveValue('Division 3');
 await page.getByLabel('Field 2 name',{exact:true}).fill('Field 1');
 await page.getByRole('button',{name:'Save Settings',exact:true}).click();
 await expect(page.getByText('Division 3: give each active field a different name, up to 80 characters.')).toBeVisible();
 expect(await page.evaluate(()=>window.savedSettings)).toBeUndefined();
 await page.getByLabel('Field 2 name',{exact:true}).fill('United Rentals');
 await page.getByRole('button',{name:'Save Settings',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.savedSettings?.divisions?.[2]?.id)).toBe(3);
});
