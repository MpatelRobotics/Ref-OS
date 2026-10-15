import {test,expect} from '@playwright/test';
test('event settings previews and saves an uploaded logo',async({page})=>{
 await page.route('**/timezone-test',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">import '/src/index.css';import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,View=(await import('/src/components/modals/EventSettingsModal.jsx')).default;DOM.createRoot(document.getElementById('root')).render(React.createElement(View,{event:{name:'Event'},brand:{shortName:'Event'},eventTimezone:'UTC',onSave:async value=>window.savedSettings=value,onClose:()=>{}}));</script>`}));
 await page.goto('/timezone-test');
 await page.getByLabel('Upload event logo').setInputFiles({name:'logo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=','base64')});
 await expect(page.getByRole('status')).toHaveText('New logo ready to save.');
 await expect(page.locator('img').first()).toHaveAttribute('src',/^data:image\/png;base64,/);
 await page.getByRole('button',{name:'Save Settings',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.savedSettings?.branding?.logoData)).toMatch(/^data:image\/png;base64,/);
 expect(await page.evaluate(()=>window.savedSettings.branding.logoUrl)).toBe('');
});
