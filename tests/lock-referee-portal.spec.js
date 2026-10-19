import {test,expect} from '@playwright/test';
test('lock dialog offers portal navigation only for account users',async({page})=>{
 await page.route('**/lock-portal-test',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">import '/src/index.css';import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,View=(await import('/src/components/modals/LockDeviceModal.jsx')).default;const root=DOM.createRoot(document.getElementById('root'));window.draw=(account)=>root.render(React.createElement(View,{eventName:'Test event',onCancel:()=>{},onMainScreen:()=>window.main=true,onEventMainPage:()=>window.event=true,onRefereePortal:account?()=>window.portal=true:undefined}));window.draw(true);</script>`}));
 await page.setViewportSize({width:390,height:650});await page.goto('/lock-portal-test');
 await page.getByRole('button',{name:/Back to Referee portal/}).click();
 expect(await page.evaluate(()=>window.portal)).toBe(true);
 expect(await page.evaluate(()=>window.main)).toBeUndefined();
 await page.evaluate(()=>window.draw(false));
 await expect(page.getByRole('button',{name:/Back to Referee portal/})).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Main Screen/})).toBeVisible();
});
