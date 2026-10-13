import {test,expect} from '@playwright/test';

test('league overview keeps first and last controls clear of phone safe areas',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/safe-area-test',route=>route.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default;const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const View=(await import('/src/league/LeagueOverview.jsx')).default;await import('/src/index.css');document.documentElement.style.setProperty('--refos-safe-top','59px');document.documentElement.style.setProperty('--refos-safe-bottom','34px');DOM.createRoot(document.getElementById('root')).render(React.createElement(View,{mode:'page',eventId:'fixture',eventName:'League Test',isAdmin:true,teamCount:19,sessions:Array.from({length:8},(_,i)=>({id:String(i+1),name:'Session '+(i+1),status:'upcoming',order:i+1})),onChooseEvent:()=>{},onOpenSession:()=>{}}));</script>`}));
 await page.goto('/safe-area-test');
 const first=page.getByRole('button',{name:'Events',exact:true});await expect(first).toBeVisible();
 expect((await first.boundingBox()).y).toBeGreaterThanOrEqual(59);
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
 const last=page.getByRole('button',{name:'Work in Session 8'});await expect(last).toBeVisible();
 const box=await last.boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(810);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
