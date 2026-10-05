import {test,expect} from '@playwright/test';
import {mapVexMatches,mapVexRankings,mapVexSkills,fetchVexMatches} from '../supabase/functions/vex-event-lookup/matches.js';
const match={round:2,instance:1,matchnum:3,name:'Q3',scored:true,alliances:[{color:'red',score:20,teams:[{team:{name:'2A'}}]},{color:'blue',score:20,teams:[{team:{name:'3B'}}]}]};
test('scored ties clear winner; unscored snapshots do not invent scores',()=>{
 expect(mapVexMatches([match])[0]).toMatchObject({phase:'qual',num:3,winner:'',redScore:20});
 expect(mapVexMatches([{...match,scored:false}])[0].redScore).toBeNull();
 expect(()=>mapVexMatches([match,match])).toThrow('overlapping');
 expect(()=>mapVexMatches([{...match,round:3,matchnum:2}])).toThrow('not supported');
});
test('rankings preserve official rank and Skills combine best runs without inventing rank',()=>{
 expect(mapVexRankings([{team:{name:'2A'},rank:2,wins:3,losses:1,ties:0}])[0]).toMatchObject({rank:2,w:3});
 expect(mapVexSkills([{team:{name:'2A'},type:'driver',score:10},{team:{name:'2A'},type:'driver',score:8},{team:{name:'2A'},type:'programming',score:15}])).toEqual([{number:'2A',driver:10,programming:15,total:25,rank:null}]);
});
test('division endpoint pagination must complete before any snapshot returns',async()=>{
 let count=0;const fetcher=async()=>{count++;return new Response(JSON.stringify(count===1?{data:[{id:1,sku:'VE-V5-27-6588'}]}:count===2?{divisions:[{id:1,name:'Main'}]}:count===3?{data:[match],meta:{last_page:2}}:{}),{status:count===4?500:200});};
 await expect(fetchVexMatches('VE-V5-27-6588',1,'fixture-token',fetcher)).rejects.toThrow('Could not retrieve');
});
test('preview and approval precede periodic updates; changing category resets approval',async({page})=>{
 await page.clock.install();
 await page.route('**/vex-sync-test',r=>r.fulfill({contentType:'text/html',body:`<html><body><div id="root"></div><script type="module">
 import '/@vite/client';import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default;const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const Sync=(await import('/src/components/VexLiveSync.jsx')).default;
 window.applied=[];window.calls=0;ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Sync,{initialCode:'VE-V5-27-6588',target:'Test',onClose:()=>{},onFetch:async()=>({divisions:[{id:1,name:'Main'}],matches:[{phase:'qual',num:1,red:['2A'],blue:['3B'],scored:true,redScore:++window.calls,blueScore:0}]}),onApply:async(data,kind)=>window.applied.push({data,kind})}));
 </script></body></html>`}));
 await page.goto('/vex-sync-test');await page.getByRole('button',{name:'Load divisions'}).click();await page.getByRole('combobox').first().selectOption('1');
 await page.getByRole('button',{name:'Check for updates'}).click();expect(await page.evaluate(()=>window.applied.length)).toBe(0);
 await page.getByRole('button',{name:'Apply snapshot'}).click();await page.getByRole('checkbox').check();await page.clock.fastForward(60000);
 await expect.poll(()=>page.evaluate(()=>window.applied.length)).toBe(2);
 await page.getByRole('checkbox').uncheck();await page.getByRole('combobox').nth(1).selectOption('skills');await expect(page.getByRole('checkbox')).toBeDisabled();
});


test('unsupported rounds do not block valid qualifications and string rounds normalize',()=>{const warnings=[]; const rows=mapVexMatches([{...match,round:'2'},{...match,round:7}],warnings);expect(rows).toHaveLength(1);expect(rows[0].phase).toBe('qual');expect(warnings[0]).toContain('round 7');});
