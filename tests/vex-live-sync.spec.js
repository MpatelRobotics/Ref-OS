import {test,expect} from '@playwright/test';
import {mapVexRankings,mapVexSkills,fetchVexStandings} from '../supabase/functions/vex-event-lookup/matches.js';
const match={round:2,instance:1,matchnum:3,name:'Q3',scored:true,alliances:[{color:'red',score:20,teams:[{team:{name:'2A'}}]},{color:'blue',score:20,teams:[{team:{name:'3B'}}]}]};

test('rankings preserve official rank and Skills combine best runs without inventing rank',()=>{
 expect(mapVexRankings([{team:{name:'2A'},rank:2,wins:3,losses:1,ties:0}])[0]).toMatchObject({rank:2,w:3});
 expect(mapVexSkills([{team:{name:'2A'},type:'driver',score:10},{team:{name:'2A'},type:'driver',score:8},{team:{name:'2A'},type:'programming',score:15}])).toEqual([{number:'2A',driver:10,programming:15,total:25,rank:null}]);
});
test('division endpoint pagination must complete before any snapshot returns',async()=>{
 let count=0;const fetcher=async()=>{count++;return new Response(JSON.stringify(count===1?{data:[{id:1,sku:'VE-V5-27-6588'}]}:count===2?{divisions:[{id:1,name:'Main'}]}:count===3?{data:[match],meta:{last_page:2}}:{}),{status:count===4?500:200});};
 await expect(fetchVexStandings('VE-V5-27-6588',1,'fixture-token',fetcher)).rejects.toThrow('Could not retrieve');
});
test('preview and approval precede periodic updates; changing category resets approval',async({page})=>{
 await page.clock.install();
 await page.route('**/vex-sync-test',r=>r.fulfill({contentType:'text/html',body:`<html><body><div id="root"></div><script type="module">
 import '/@vite/client';import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default;const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const Sync=(await import('/src/components/VexLiveSync.jsx')).default;
 window.applied=[];window.calls=0;function Harness(){const [visible,setVisible]=React.useState(true);const [savedCode,setSavedCode]=React.useState('');window.restoreCode=()=>setSavedCode('VE-V5-27-6588');return React.createElement(Sync,{initialCode:savedCode,onSaveCode:async code=>{window.savedCode=code;},target:'Test',visible,onOpen:()=>setVisible(true),onClose:()=>setVisible(false),onFetch:async()=>({divisions:[{id:1,name:'Main'}],rankings:[{number:'2A',rank:++window.calls}]}),onApply:async(data,kind)=>window.applied.push({data,kind})});}ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
 </script></body></html>`}));
 await page.goto('/vex-sync-test');await expect(page.getByRole('textbox')).toHaveValue('');await page.evaluate(()=>window.restoreCode());await expect(page.getByRole('combobox').first()).toHaveValue('1');await expect.poll(()=>page.evaluate(()=>window.savedCode)).toBe('VE-V5-27-6588');
 await expect(page.getByRole('combobox')).toHaveCount(1);await page.getByRole('button',{name:'Check for updates'}).click();expect(await page.evaluate(()=>window.applied.length)).toBe(0);
 await page.getByRole('button',{name:'Start syncing'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByLabel('VEX sync status')).toBeVisible();await page.clock.fastForward(60000);
 await expect.poll(()=>page.evaluate(()=>window.applied.length)).toBe(2);
 await page.getByRole('button',{name:'Manage VEX sync'}).click();await page.getByRole('checkbox').uncheck();await page.getByRole('combobox').first().selectOption('');await expect(page.getByRole('checkbox')).toBeDisabled();
});





test('match sync requests are rejected before contacting VEX',async()=>{await expect(fetchVexStandings('VE-V5-27-6588',1,'fixture-token',()=>{throw new Error('Should not fetch');},'matches')).rejects.toThrow('qualification rankings, Skills and scores only');});

test('Skills sync uses event-wide endpoint and all pages without a division',async()=>{
 const urls=[];const fetcher=async url=>{urls.push(String(url));const n=urls.length;return new Response(JSON.stringify(n===1?{data:[{id:1,sku:'VE-V5-27-6588'}]}:n===2?{divisions:[{id:1,name:'Main'},{id:2,name:'Other'}]}:{data:[{team:{name:'2A'},type:n===3?'driver':'programming',score:n===3?10:15}],meta:{last_page:2}}));};
 const result=await fetchVexStandings('VE-V5-27-6588',null,'fixture-token',fetcher,'skills');expect(result.skills[0]).toMatchObject({number:'2A',driver:10,programming:15,total:25});expect(urls.slice(2).every(url=>url.includes('/events/1/skills?')&&!url.includes('/divisions/'))).toBe(true);expect(result.rankings).toEqual([]);
});

test('Skills preview imports Skills and continues with modal closed',async({page})=>{
 await page.clock.install();
 await page.route('**/vex-sync-test',r=>r.fulfill({contentType:'text/html',body:`<html><body><div id="root"></div><script type="module">
 import '/@vite/client';import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default;const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const Sync=(await import('/src/components/VexLiveSync.jsx')).default;
 window.applied=[];window.calls=0;function Harness(){const [visible,setVisible]=React.useState(true);const [savedCode,setSavedCode]=React.useState('');window.restoreCode=()=>setSavedCode('VE-V5-27-6588');return React.createElement(Sync,{initialCode:savedCode,onSaveCode:async code=>{window.savedCode=code;},category:'skills',target:'Test',visible,onOpen:()=>setVisible(true),onClose:()=>setVisible(false),onFetch:async()=>({divisions:[{id:1,name:'Main'}],skills:[{number:'2A',driver:++window.calls,programming:15,total:16}]}),onApply:async(data,kind)=>window.applied.push({data,kind})});}ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
 </script></body></html>`}));
 await page.goto('/vex-sync-test');await expect(page.getByRole('textbox')).toHaveValue('');await page.evaluate(()=>window.restoreCode());await expect(page.getByRole('combobox')).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>window.savedCode)).toBe('VE-V5-27-6588');
 await expect(page.getByRole('combobox')).toHaveCount(0);await page.getByRole('button',{name:'Check for updates'}).click();expect(await page.evaluate(()=>window.applied.length)).toBe(0);
 await page.getByRole('button',{name:'Start syncing'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByLabel('VEX Skills sync status')).toBeVisible();await page.clock.fastForward(60000);
 await expect.poll(()=>page.evaluate(()=>window.applied.length)).toBe(2);
 expect(await page.evaluate(()=>window.applied.every(entry=>entry.kind==='skills'))).toBe(true);await page.getByRole('button',{name:'Manage VEX Skills sync'}).click();await page.getByRole('checkbox').uncheck();
});

test('scores-only previews scores and syncs independently with division selection',async({page})=>{
 await page.clock.install();
 await page.route('**/vex-sync-test',r=>r.fulfill({contentType:'text/html',body:`<html><body><div id="root"></div><script type="module">
 import '/@vite/client';import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default;const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const Sync=(await import('/src/components/VexLiveSync.jsx')).default;
 window.applied=[];window.calls=0;function Harness(){const [visible,setVisible]=React.useState(true);const [savedCode,setSavedCode]=React.useState('');window.restoreCode=()=>setSavedCode('VE-V5-27-6588');return React.createElement(Sync,{initialCode:savedCode,onSaveCode:async code=>{window.savedCode=code;},category:'scores',target:'Test',visible,onOpen:()=>setVisible(true),onClose:()=>setVisible(false),onFetch:async()=>({divisions:[{id:1,name:'Main'}],scores:[{phase:'qual',num:3,redScore:++window.calls,blueScore:0}]}),onApply:async(data,kind)=>window.applied.push({data,kind})});}ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
 </script></body></html>`}));
 await page.goto('/vex-sync-test');await expect(page.getByRole('textbox')).toHaveValue('');await page.evaluate(()=>window.restoreCode());await expect(page.getByRole('combobox').first()).toHaveValue('1');await expect.poll(()=>page.evaluate(()=>window.savedCode)).toBe('VE-V5-27-6588');
 await expect(page.getByRole('combobox')).toHaveCount(1);await page.getByRole('button',{name:'Check for updates'}).click();expect(await page.evaluate(()=>window.applied.length)).toBe(0);
 await page.getByRole('button',{name:'Start syncing'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByLabel('VEX scores sync status')).toBeVisible();await page.clock.fastForward(60000);
 await expect.poll(()=>page.evaluate(()=>window.applied.length)).toBe(2);
 await page.getByRole('button',{name:'Manage VEX scores sync'}).click();await page.getByRole('checkbox').uncheck();await page.getByRole('combobox').first().selectOption('');await expect(page.getByRole('checkbox')).toBeDisabled();
});
