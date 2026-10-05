import {test,expect} from '@playwright/test';
import {searchEvents} from '../supabase/functions/vex-event-lookup/lookup.js';
const filters={country:'US',state:'New York',start:'2026-10-01',end:'2026-12-31'};
test('USA search uses region/date filters and excludes foreign states/workshops',async()=>{
 let url;const response=await searchEvents(filters,'fixture-token',async(request)=>{url=request;return new Response(JSON.stringify({meta:{last_page:1},data:[
 {sku:'RE-V5RC-26-4270',name:'NY event',start:'2026-10-04',location:{country:'United States',region:'New York',city:'Flushing'},event_type:'tournament'},
 {sku:'RE-V5RC-26-4271',name:'Foreign',location:{country:'Canada',region:'New York'},event_type:'tournament'},
 {sku:'RE-V5RC-26-4272',name:'Other state',location:{country:'United States',region:'New Jersey'},event_type:'tournament'},
 {sku:'RE-V5RC-26-4273',name:'Workshop',location:{country:'United States',region:'New York'},event_type:'workshop'}
 ]}),{status:200});});
 expect(url.searchParams.get('region')).toBe('New York');expect(url.searchParams.get('start')).toContain('2026-10-01');expect(response.events.map(e=>e.name)).toEqual(['NY event']);expect(response.nextPage).toBeNull();
});
test('search has a continuation instead of silently dropping later pages',async()=>{
 const response=await searchEvents(filters,'fixture-token',async()=>new Response(JSON.stringify({meta:{last_page:7},data:[]}),{status:200}));
 expect(response.events).toEqual([]);expect(response.nextPage).toBe(6);
 await expect(searchEvents({...filters,country:'CA'},'fixture-token')).rejects.toThrow('Enter a country');
});
async function mount(page){
 await page.route('**/event-finder-test',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
 import '/@vite/client';import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default;const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
 const Finder=(await import('/src/components/VexEventFinder.jsx')).default;window.selectedCode=null;window.searchFilters=null;
 ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Finder,{onSelect:v=>window.selectedCode=v,onSearch:async filters=>{window.searchFilters=filters;return {events:[{code:filters.page===1?'RE-V5RC-26-4270':'RE-V5RC-26-4271',name:filters.page===1?'Test event':'Next event',start:'2026-10-04',city:'Flushing'}],nextPage:filters.page===1?2:null};}}));
 </script></body></html>`}));await page.goto('/event-finder-test');
}
test('state search, continuation and selected event work without country picker',async({page})=>{
 await mount(page);await expect(page.getByLabel('Country',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Find events',exact:true})).toBeDisabled();
 await page.getByLabel('State or territory').selectOption('New York');await page.getByRole('button',{name:'Find events',exact:true}).click();
 await expect(page.getByLabel('Select VEX event').locator('option')).toHaveCount(2);
 expect((await page.evaluate(()=>window.searchFilters)).country).toBe('US');
 await page.getByRole('button',{name:'Load more events'}).click();await expect(page.getByLabel('Select VEX event').locator('option')).toHaveCount(3);
 await page.getByLabel('Select VEX event').selectOption('RE-V5RC-26-4271');await page.getByRole('button',{name:'Use selected event'}).click();expect(await page.evaluate(()=>window.selectedCode)).toBe('RE-V5RC-26-4271');
 await page.getByLabel('State or territory').selectOption('New Jersey');await expect(page.getByLabel('Select VEX event')).toHaveCount(0);
});
