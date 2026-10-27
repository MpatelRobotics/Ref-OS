import {test,expect} from '@playwright/test';
import {DEMO_EVENTS} from '../src/demoEvents.js';
test('demo code comes before program choice and routes each program separately',async({page})=>{
 await page.route('**/demo-launcher-test',route=>route.fulfill({contentType:'text/html',body:`<html><body><div id="root"></div><script type="module">
 const React=(await import('/node_modules/.vite/deps/react.js')).default;
 const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
 const RefreshRuntime=(await import('/@react-refresh')).default;RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
 const C=(await import('/src/components/DemoLauncher.jsx')).default;
 DOM.createRoot(document.getElementById('root')).render(React.createElement(C,{onChoose:id=>window.chosen=id}));
 </script></body></html>`}));
 await page.goto('/demo-launcher-test');
 await page.getByRole('button',{name:'Try the DEMO'}).click();
 await expect(page.getByRole('button',{name:/^V5 .*Override$/})).toHaveCount(0);
 await page.getByLabel('Demo code').fill('NOPE');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
 await page.getByLabel('Demo code').fill('VTOW');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:/^V5 .*Override$/}).click();
 expect(await page.evaluate(()=>window.chosen)).toBe(DEMO_EVENTS.v5);
 await page.getByRole('button',{name:/^VEX IQ .*Level Up$/}).click();
 expect(await page.evaluate(()=>window.chosen)).toBe(DEMO_EVENTS.iq);
 expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('refosDemoEntry')).code)).toBe('VTOW');
});
