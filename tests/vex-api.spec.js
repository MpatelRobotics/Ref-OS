import {test,expect} from '@playwright/test';
import {lookupEvent,normalizeCode} from '../supabase/functions/vex-event-lookup/lookup.js';
const event={id:123,sku:'RE-V5RC-26-4270',name:'Test event',start:'2026-10-04T09:00:00Z',end:'2026-10-04T17:00:00Z',program:{name:'V5RC'},location:{city:'Flushing',region:'New York'},event_type:'tournament',private_contact:'must not return'};
const response=body=>new Response(JSON.stringify(body),{status:200});
test('lookup uses exact SKU and all roster pages, strips unrelated fields',async()=>{
 const requests=[];
 const fetcher=async(url,options)=>{requests.push(url.toString());expect(options.headers.Authorization).toBe('Bearer fixture-token');
 if(url.pathname.endsWith('/events'))return response({data:[event,{...event,sku:'RE-V5RC-26-9999'}]});
 return response({meta:{last_page:2},data:url.searchParams.get('page')==='1'?[{number:'20B',team_name:'Twenty'}]:[{number:'2A',team_name:'Two'},{number:'20B',team_name:'Twenty'}]});};
 const result=await lookupEvent(' re-v5rc-26-4270 ','fixture-token',fetcher);
 expect(new URL(requests[0]).searchParams.get('sku[]')).toBe(event.sku);
 expect(requests).toHaveLength(3);expect(result.teams.map(t=>t.number)).toEqual(['2A','20B']);
 expect(result).not.toHaveProperty('private_contact');expect(JSON.stringify(result)).not.toContain('fixture-token');
});
test('bad codes, missing token and unavailable API fail safely',async()=>{
 expect(()=>normalizeCode('3S23')).toThrow('full VEX event code');
 await expect(lookupEvent(event.sku,'')).rejects.toThrow('not configured');
 await expect(lookupEvent(event.sku,'fixture-token',async()=>new Response('secret upstream content',{status:401}))).rejects.toThrow('Could not retrieve');
});
test('failed later roster page never returns a partial roster',async()=>{
 let calls=0;await expect(lookupEvent(event.sku,'fixture-token',async()=>{
 calls++;if(calls===1)return response({data:[event]});if(calls===2)return response({data:[{number:'2A'}],meta:{last_page:2}});return new Response('error',{status:500});
 })).rejects.toThrow('Could not retrieve');expect(calls).toBe(3);
});
async function mount(page,fail=false){
 await page.route('**/vex-autofill-test',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
 import '/@vite/client';import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default;const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
 const Lookup=(await import('/src/components/VexEventLookup.jsx')).default;window.lookupResult=null;
 ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Lookup,{onResult:v=>window.lookupResult=v,onLookup:async()=>{${fail?"throw new Error('Lookup unavailable');":"return {code:'RE-V5RC-26-4270',name:'Test event',program:'V5RC',location:'Flushing',teams:[{number:'2A',name:'Two'}]};"}}}));
 </script></body></html>`}));await page.goto('/vex-autofill-test');
}
test('autofill previews teams and clears old results when code changes',async({page})=>{
 await mount(page);await page.getByLabel('Autofill from VEX Events (optional)').fill('RE-V5RC-26-4270');await page.getByRole('button',{name:'Look up',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('1 registered teams');expect((await page.evaluate(()=>window.lookupResult)).name).toBe('Test event');
 await page.getByLabel('Autofill from VEX Events (optional)').fill('RE-V5RC-26-9999');await expect(page.getByRole('status')).toHaveCount(0);expect(await page.evaluate(()=>window.lookupResult)).toBeNull();
});
test('lookup failure explains manual fallback',async({page})=>{
 await mount(page,true);await page.getByLabel('Autofill from VEX Events (optional)').fill('RE-V5RC-26-4270');await page.getByRole('button',{name:'Look up',exact:true}).click();await expect(page.getByRole('alert')).toContainText('create the event manually');
});


test('both RE and VE event codes normalize and VE lookup keeps the exact SKU',async()=>{
 expect(normalizeCode('re-v5rc-26-4246')).toBe('RE-V5RC-26-4246');
 expect(normalizeCode(' ve-v5-27-65868 ')).toBe('VE-V5-27-65868');
 const result=await lookupEvent('VE-V5-27-65868','fixture-token',async url=>{
   if(url.pathname.endsWith('/events')) {expect(url.searchParams.get('sku[]')).toBe('VE-V5-27-65868');return response({data:[{...event,sku:'VE-V5-27-65868'}]});}
   return response({data:[],meta:{last_page:1}});
 });
 expect(result.code).toBe('VE-V5-27-65868');
 expect(()=>normalizeCode('VE-V5-27-65868/../../')).toThrow();
});
