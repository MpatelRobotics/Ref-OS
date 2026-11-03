import {test,expect} from '@playwright/test';
test('parallel saves across tabs and removal preserve every pending record',async({page,context})=>{
 await page.goto('/');const other=await context.newPage();await other.goto('/');
 const save=async(p,start)=>p.evaluate(async start=>{const q=await import('/src/outbox.js');for(let i=start;i<start+20;i++)await q.enqueue('atomic-review',{id:String(i),kind:'team'});},start);
 await Promise.all([save(page,0),save(other,20)]);
 expect(await page.evaluate(async()=> (await (await import('/src/outbox.js')).loadQueue('atomic-review')).length)).toBe(40);
 await Promise.all([page.evaluate(async()=>{const q=await import('/src/outbox.js');for(let i=0;i<20;i++)await q.removeOp('atomic-review',String(i));}),save(other,40)]);
 const ids=await page.evaluate(async()=> (await (await import('/src/outbox.js')).loadQueue('atomic-review')).map(x=>x.id).sort((a,b)=>a-b));
 expect(ids).toEqual(Array.from({length:40},(_,i)=>String(i+20)));
});
test('failed initial import remains stopped and can retry identical rankings',async({page})=>{
 await page.route('**/sync-failure-review',r=>r.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import '/@vite/client';import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default;const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const Sync=(await import('/src/components/VexLiveSync.jsx')).default;window.attempts=0;function Harness(){const ref=React.useRef();window.start=()=>ref.current.start('RE-V5RC-26-1234',1).catch(e=>e.message);return React.createElement(Sync,{ref,visible:false,onFetch:async()=>({divisions:[{id:1}],rankings:[{number:'1A',rank:1}]}),onApply:async()=>{if(++window.attempts===1)throw Error('Write refused');}});}DOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));</script>`}));
 await page.goto('/sync-failure-review');await expect.poll(()=>page.evaluate(()=>typeof window.start)).toBe('function');
 expect(await page.evaluate(()=>window.start())).toContain('Write refused');await expect(page.getByText('VEX rankings sync stopped')).toBeVisible();
 await page.evaluate(()=>window.start());await expect(page.getByText(/VEX rankings sync active/)).toBeVisible();expect(await page.evaluate(()=>window.attempts)).toBe(2);
});
