import {test,expect} from '@playwright/test';
test('collapsed bottom section preserves access to unscheduled robots',async({page})=>{
 await page.route('**/unscheduled-test',route=>route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default;const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const View=(await import('/src/components/UnscheduledTeams.jsx')).default;window.testAccess={role:'admin',developer:false};window.logins=[];DOM.createRoot(document.getElementById('root')).render(React.createElement(View,{teams:[{number:'3C',name:'Preserved team'}],robots:true,onOpen:number=>window.logins.push(number)}));</script>`}));
 await page.goto('/unscheduled-test');


 await expect(page.getByRole('button',{name:/3C/})).toBeHidden();
 await page.getByText('Not in match list (1)').click();
 await page.getByRole('button',{name:/3C/}).click();
 expect(await page.evaluate(()=>window.logins)).toEqual(['3C']);
});
