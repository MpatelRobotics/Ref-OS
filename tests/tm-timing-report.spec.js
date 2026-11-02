import {test,expect} from '@playwright/test';
test('TM timing report remains readable on mobile and shows observed stages',async({page})=>{
 await page.route('**/timing-test',r=>r.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">
 const React=(await import('/node_modules/.vite/deps/react.js')).default;const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
 const RefreshRuntime=(await import('/@react-refresh')).default;RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
 const C=(await import('/src/components/TmTimingReport.jsx')).default;
 DOM.createRoot(document.getElementById('root')).render(React.createElement(C,{activity:{updatedAt:Date.now(),fieldSets:[{connected:true}],timing:[{key:'run',phase:'qual',num:1,fieldKey:'1:1',field:'Field 1',assignedAt:1000,startedAt:2000,stoppedAt:122000,scoreObservedAt:132000}]},matches:{q:{phase:'qual',num:1,red:['1A'],blue:['2A']}},times:[{phase:'qual',num:1,red:['1A'],blue:['2A'],scheduledAt:new Date(1000).toISOString()}]}));
 </script>`}));
 page.on('pageerror',e=>console.log(e.message));
 await page.setViewportSize({width:390,height:844});await page.goto('/timing-test');
 await expect(page.getByRole('heading',{name:'Schedule delay estimate'})).toBeVisible();
 await expect(page.getByText('Q1 started 0m 1s late.')).toBeVisible();await expect(page.getByText('2m 0s',{exact:true})).toBeVisible();await expect(page.getByText('0m 10s',{exact:true})).toBeVisible();
 await expect(page.getByText('Actual finish (observed stop)',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
