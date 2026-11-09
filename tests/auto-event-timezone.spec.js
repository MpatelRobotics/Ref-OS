import {test,expect} from '@playwright/test';
test('linked VEX U code detects and saves timezone once, then preserves manual changes',async({page})=>{
 await page.route('**/auto-timezone-test',route=>route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">
 import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,Auto=(await import('/src/components/AutoEventTimezone.jsx')).default;
 window.lookups=0;window.writes=[];window.stored=null;
 const api={lookupVexEvent:async code=>{window.lookups++;return {code,timezone:'America/Toronto',timezoneCode:code,timezoneSource:'Venue coordinates'};},getEventSetting:async()=>window.stored,upsertEventSetting:async(id,key,value)=>{window.writes.push(value);return window.stored={key,value};}};
 function Harness(){const[saved,setSaved]=React.useState(null);return React.createElement(React.Fragment,null,React.createElement(Auto,{api,eventId:'event',details:{code:'VE-U-26-66279'},saved,enabled:true,onSaved:setSaved}),React.createElement('p',{role:'status'},saved?.value.zone||'Not set'),React.createElement('button',{onClick:()=>{window.stored={value:{zone:'Europe/London'}};setSaved(window.stored);}},'Manual timezone'));}
 DOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
 </script>`}));
 await page.goto('/auto-timezone-test');await expect(page.getByRole('status')).toHaveText('America/Toronto');
 expect(await page.evaluate(()=>window.lookups)).toBe(1);expect(await page.evaluate(()=>window.writes.length)).toBe(1);
 await page.getByRole('button',{name:'Manual timezone'}).click();await expect(page.getByRole('status')).toHaveText('Europe/London');
 expect(await page.evaluate(()=>window.writes.length)).toBe(1);
});
