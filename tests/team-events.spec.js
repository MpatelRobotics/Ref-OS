import {test,expect} from '@playwright/test';
import {lookupTeamEvents} from '../supabase/functions/vex-event-lookup/team-events.js';
const response=data=>new Response(JSON.stringify(data));
test('exact team and complete event pagination, strips private fields',async()=>{
 const urls=[];const result=await lookupTeamEvents(' 2a ','fixture',async url=>{urls.push(String(url));if(url.pathname.endsWith('/teams'))return response({data:[{id:4,number:'2A'}],meta:{last_page:1}});return response({data:[{id:Number(url.searchParams.get('page')),sku:'RE-V5RC-26-5323',name:'Event',start:'2026-10-06',private_contact:'hidden'}],meta:{last_page:2}});},new Date('2026-10-05'));
 expect(result.events).toHaveLength(2);expect(urls[0]).toContain('number%5B%5D=2A');expect(JSON.stringify(result)).not.toContain('hidden');expect(JSON.stringify(result)).not.toContain('fixture');expect(result.events[0].url).toContain('RE-V5RC-26-5323.html');
});
test('ambiguity and incomplete pagination fail without partial results',async()=>{
 await expect(lookupTeamEvents('2A','fixture',async()=>response({data:[{id:1,number:'2A'},{id:2,number:'2A'}],meta:{last_page:1}}))).rejects.toThrow('No unique');
 let calls=0;await expect(lookupTeamEvents('2A','fixture',async()=>{calls++;return calls===1?response({data:[{id:1,number:'2A'}],meta:{last_page:1}}):new Response('private error',{status:500});})).rejects.toThrow('Could not retrieve');
});
test('team event list puts upcoming first and retains offline copy',async({page})=>{
 await page.route('**/team-events-test',r=>r.fulfill({contentType:'text/html',body:`<html><body><div id="root"></div><script type="module">
 import '/@vite/client';import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default;const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const Panel=(await import('/src/components/TeamRegisteredEvents.jsx')).default;window.calls=0;
 const root=ReactDOM.createRoot(document.getElementById('root'));window.mountPanel=key=>root.render(React.createElement(Panel,{key,...{number:'2A',onLookup:async()=>{window.calls++;return {number:'2A',checkedAt:new Date().toISOString(),events:[{id:1,name:'Past event',start:'2020-01-01',code:'Past'},{id:2,name:'Future event',start:'2099-01-01',code:'Future'}]};}}}));window.mountPanel(1);
 </script></body></html>`}));
 await page.goto('/team-events-test');await expect(page.getByRole('listitem').first()).toContainText('Future event');await page.context().setOffline(true);await page.evaluate(()=>{window.calls=0;window.mountPanel(2);});await expect(page.getByRole('listitem')).toHaveCount(2);await expect(page.getByText(/Saved offline copy/)).toBeVisible();expect(await page.evaluate(()=>window.calls)).toBe(0);
});

