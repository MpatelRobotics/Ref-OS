import {test,expect} from '@playwright/test';
async function mount(page,unlocked=true){
 await page.route(/\/src\/components\/JudgingInterviews\.jsx(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:`import React from '/node_modules/.vite/deps/react.js';export default function(){return React.createElement('h2',null,'Judge Advisor planning workspace');}`}));
 await page.route('**/judging-connector-test',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">
 import '/src/index.css';import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,View=(await import('/src/components/JudgingConnector.jsx')).default;
 window.loads=0;window.rows=[{id:'nom-1',team:'119A',award:'Sportsmanship',reason:'Helped another team',by:'Referee',createdAt:Date.now()}];
 const service={claimEventAccess:async()=>({serverRole:'${unlocked?'admin':'ref'}'}),listSelectableEvents:async()=>[{id:'event-one',name:'Test Event'}],onAuth:()=>null};
 const loadWorkspace=async()=>{window.loads++;return {event:{name:'Test Event',format:'tournament'},teams:[{number:'119A',name:'Test Team'}],settings:[],sessions:[],matches:[],nominations:structuredClone(window.rows)}};
 const subscribe=(id,changed,status)=>{window.changed=changed;status('SUBSCRIBED');return()=>{}};
 DOM.createRoot(document.getElementById('root')).render(React.createElement(View,{service,loadWorkspace,subscribe}));
 </script>`}));await page.goto('/judging-connector-test');
}
test('independent judging workspace receives live Ref-OS nominations without loading violations',async({page})=>{
 const violations=[];page.on('request',r=>{if(r.url().includes('/rest/v1/violations'))violations.push(r.url());});
 await mount(page);await page.getByRole('combobox',{name:'Judging event',exact:true}).selectOption('event-one');await page.getByLabel('Event admin code').fill('TEST');await page.getByRole('button',{name:'Open judging workspace',exact:true}).click();await expect(page.getByRole('heading',{name:'Judge Advisor planning workspace'})).toBeVisible();
 await page.getByRole('button',{name:'Nominations',exact:true}).click();await expect(page.getByText('Helped another team')).toBeVisible();
 await page.evaluate(()=>{window.rows.push({id:'nom-2',team:'119A',award:'Judges Award',reason:'New real-time nomination',createdAt:Date.now()});window.changed({table:'nominations'});});
 await expect(page.getByText('New real-time nomination')).toBeVisible();await expect(page.getByRole('status')).toContainText('Live connection');expect(violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('connector rejects non-admin event codes',async({page})=>{await mount(page,false);await page.getByRole('combobox',{name:'Judging event',exact:true}).selectOption('event-one');await page.getByLabel('Event admin code').fill('REF');await page.getByRole('button',{name:'Open judging workspace',exact:true}).click();await expect(page.getByRole('alert')).toContainText('event admin code');expect(await page.evaluate(()=>window.loads)).toBe(0);});
