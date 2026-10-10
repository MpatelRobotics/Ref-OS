import {test,expect} from '@playwright/test';
test('two divisions on one server sync sequentially to distinct divisions; one failure keeps the other running',async({page})=>{
 await page.clock.install();
 await page.addInitScript(()=>{window.refosTmDesktop={setSyncActive:async()=>{}};});
 await page.route('**/two-server-test',r=>r.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
 const RefreshRuntime=(await import('/@react-refresh')).default;RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default;const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const Component=(await import('/src/components/TmMultiServerSync.jsx')).default;await import('/src/index.css');window.applied=[];window.closedConnections=[];window.flight=0;window.maxFlight=0;window.failSecond=false;
 function Harness(){const [open,setOpen]=React.useState(true);return React.createElement(Component,{open,onClose:()=>setOpen(false),onExit:()=>{},refosDivisions:[{id:10,name:'Science'},{id:20,name:'Technology'}],expectedCode:'RE-V5RC-26-1234',onFetch:async body=>{window.flight++;window.maxFlight=Math.max(window.flight,window.maxFlight);await Promise.resolve();window.flight--;if(window.failSecond&&body.channelId==='server-2')throw Error('Server 2 unavailable');const header={multiServer:true,event:{name:'Event',code:'RE-V5RC-26-1234'},divisions:[{id:1,name:'Science'},{id:2,name:'Technology'}]};if(body.division==null)return header;return {...header,teams:[],rankings:[],skills:[],matches:[{finalScore:[4,2],matchInfo:{state:'SCORED',matchTuple:{session:0,division:body.division,round:'QUAL',instance:1,match:1},alliances:[{teams:[{number:'1A'},{number:'2A'}]},{teams:[{number:'3A'},{number:'4A'}]}]}}],connectionId:body.channelId};},onApply:async(data,options)=>window.applied.push({division:options.refosDivisionId,skills:options.includeSkills}),onActivity:async()=>({fieldSets:[]}),onPublishActivity:async()=>{},onDisconnect:async id=>window.closedConnections.push(id)});}DOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
 </script></body></html>`}));
 await page.goto('/two-server-test');
 await page.getByLabel('TM server IP address').fill('192.168.0.10');await page.getByLabel('Event API key').fill('event-key');
 const fields=page.getByRole('group').filter({has:page.getByLabel('Ref OS division')});
 for(let i=0;i<2;i++){
  await page.getByRole('button',{name:'Review division '+(i+1),exact:true}).click();
  await expect(fields.nth(i).getByRole('status')).toContainText('1 matches');
 }
 await page.getByRole('button',{name:'Start both divisions',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.applied.length)).toBe(2);
 expect(await page.evaluate(()=>window.applied)).toEqual([{division:10,skills:true},{division:20,skills:false}]);
 expect(await page.evaluate(()=>window.maxFlight)).toBe(1);
 await page.evaluate(()=>window.failSecond=true);await page.clock.runFor(31000);
 await expect.poll(()=>page.evaluate(()=>window.applied.length)).toBe(3);
 await expect(page.getByRole('status')).toContainText('Server 2 unavailable');
 await page.evaluate(()=>window.failSecond=false);await page.clock.runFor(16000);await expect.poll(()=>page.evaluate(()=>window.applied.length)).toBe(4);
 await page.getByRole('button',{name:'Stop both divisions',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.closedConnections.length)).toBe(3);
 await page.clock.runFor(31000);expect(await page.evaluate(()=>window.applied.length)).toBe(4);
});
