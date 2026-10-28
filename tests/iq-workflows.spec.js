import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const preamble=`import '/@vite/client';import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;`;
async function mount(page,body){await page.route('**/iq-workflow-test',r=>r.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">${preamble}const React=(await import('/node_modules/.vite/deps/react.js')).default;const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const IQ=await import('/src/iq/IQWorkflows.jsx');await import('/src/index.css');${body}</script></body></html>`}));await page.goto('/iq-workflow-test');}
test('ranked finals preview can cancel and then apply with no elimination winners',async({page})=>{
 await mount(page,`window.rows=[];ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(IQ.default,{finals:true,teams:[1,2,3,4].map(n=>({number:n+'A',rank:n})),canEdit:true,onCreateFinals:rows=>window.rows=rows,onOpen:()=>{}}));`);
 await page.getByLabel('Number of finals matches').fill('2');await page.getByRole('button',{name:'Preview ranked finals pairings'}).click();
 await expect(page.getByRole('region',{name:'IQ import preview'})).toContainText('F1 · 3A + 4A');
 await page.getByRole('button',{name:'Cancel preview'}).click();expect(await page.evaluate(()=>window.rows)).toEqual([]);
 await page.getByRole('button',{name:'Preview ranked finals pairings'}).click();await page.getByRole('button',{name:'Apply IQ matches'}).click();
 await expect.poll(()=>page.evaluate(()=>window.rows.map(m=>m.red))).toEqual([['3A','4A'],['1A','2A']]);
 await expect(page.getByRole('button',{name:/Set winner|Advance/})).toHaveCount(0);
});

async function mockIQApp(page,role="admin"){
 await page.route('https://example.supabase.co/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 await page.route(/\/src\/api(?:\.js)?(?:\?.*)?$/,async r=>{
  const res=await r.fetch();let source=await res.text();
  source=source.replace('name: "Highlander Summit", branding: {}','name: "IQ Fixture", branding: {}').replace('11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999');
  source=source.replace('const e2eState = { teams: [], violations: [] };','const e2eState = { teams: [{number:"123A",name:"Partner One",rank:1,photoKeys:[]},{number:"456B",name:"Partner Two",rank:2,photoKeys:[]}], violations: [] };');
  source=source.replace('name: "Highlander Summit E2E"','name: "IQ Fixture"');
  source=source.replace('export async function getMyEventAccess(eventId) {','export async function getMyEventAccess(eventId) { if(E2E_MOCK) return {role:"'+role+'",developer:false};');
  source=source.replace('export async function getEventCompetitionProgram(eventId) {','export async function getEventCompetitionProgram(eventId) { if(E2E_MOCK) return {key:"competition_program",value:{program:"iq"}};');
  source=source.replace('export async function listEventSettings(eventId) {','export async function listEventSettings(eventId) { if(E2E_MOCK) return {competition_program:{value:{program:"iq"}},qualification_records:{value:{records:{"123A":{avgPoints:42,played:4},"456B":{avgPoints:38,played:4}}}}};');
  source=source.replace(/export async function listMatches\(eventId[^\n]+\{\r?\n/,'export async function listMatches(eventId) { if(E2E_MOCK) return [{id:"1",phase:"qual",num:1,red:["123A","456B"],blue:[],redScore:42,blueScore:null,field:"Field 1"}];');
  await r.fulfill({response:res,body:source});
 });
 await page.goto('/');await page.getByRole('button',{name:/IQ Fixture/}).first().click();

 await page.getByPlaceholder('e.g. Maharshi').fill('IQTester');await page.getByPlaceholder('Required for exports').nth(0).fill('IQ');await page.getByPlaceholder('Required for exports').nth(1).fill('Tester');await page.getByRole('button',{name:'Start logging',exact:true}).click();await page.getByRole('button',{name:'Close Quick Start'}).click();
}
test('real app selects IQ teamwork and IQ violation rules instead of V5 tools',async({page})=>{
 const scoreWrites=[];page.on('request',r=>{if(r.method()==='PATCH'&&r.url().includes('/rest/v1/matches'))scoreWrites.push({url:r.url(),body:r.postDataJSON()});});
 await mockIQApp(page);
 await page.getByRole('button',{name:/Q1.*123A \+ 456B/}).click();await expect(page.getByText('Teamwork partners',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'AWP check',exact:true})).toHaveCount(0);
 await expect(page.getByText('Level Up scoring aid',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Save shared score'})).toHaveCount(0);
 await expect(page.getByText('Shared score: 42',{exact:true})).toBeVisible();
 expect(scoreWrites).toEqual([]);
 await page.getByRole('button',{name:/123A.*Log/}).click();await page.getByRole('button',{name:'Select rules',exact:true}).click();
 await page.getByPlaceholder('Search code or description').fill('SG6');await expect(page.getByText('Possession / Plowing is limited to a maximum of one (1) Bean Bag',{exact:true}).first()).toBeVisible();await expect(page.getByText('Autonomous Win Point criteria',{exact:true})).toHaveCount(0);
 await page.screenshot({path:test.info().outputPath('iq-rule-selection.png'),fullPage:true});
});

test('Inspection uses IQ preparation and photos without V5 Lexan or admin match controls',async({page})=>{
 await mockIQApp(page,'inspection');
 await page.getByRole('button',{name:/123A/}).first().click();
 await expect(page.getByRole('heading',{name:'IQ inspection preparation'})).toBeVisible();
 await expect(page.getByText(/11 × 20 × 15 inches/)).toBeVisible();
 await expect(page.getByRole('button',{name:/Lexan/})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Take Front',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Save shared score'})).toHaveCount(0);
 await page.screenshot({path:test.info().outputPath('iq-inspection.png'),fullPage:true});
});
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const appSource=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const rankingsSource=appSource.slice(appSource.indexOf('function EventRankings('),appSource.indexOf('\nfunction Rankings(',appSource.indexOf('function EventRankings(')));
const compiledRankings=transformSync(`import React from '/node_modules/.vite/deps/react.js';const {useState}=React;const Empty=({title})=>React.createElement('p',null,title);${rankingsSource}\nexport default EventRankings;`,{loader:'jsx',format:'esm'}).code;
test('IQ standings display official average/played and Autonomous Coding skills, without V5 WLT',async({page})=>{
 await page.route('**/iq-ranking-component.js',r=>r.fulfill({contentType:'text/javascript',body:compiledRankings}));
 await mount(page,`const Rankings=(await import('/iq-ranking-component.js')).default;ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Rankings,{isIQ:true,teams:[{number:'123A',name:'One',rank:1}],records:{},importedRecords:{'123A':{avgPoints:42.5,played:4}},skills:[{number:'123A',rank:1,driver:20,programming:30,total:50}]}));`);
 await expect(page.getByRole('columnheader',{name:'Average score'})).toBeVisible();await expect(page.getByRole('cell',{name:'42.5',exact:true})).toBeVisible();await expect(page.getByRole('columnheader',{name:'W L T'})).toHaveCount(0);
 await page.getByRole('button',{name:'Skills Challenge',exact:true}).click();await expect(page.getByRole('columnheader',{name:'Autonomous Coding'})).toBeVisible();await expect(page.getByRole('cell',{name:'50',exact:true})).toBeVisible();
});
test('Inspection program cache is specific to its event and survives a failed read',async({page})=>{
 await page.route(/\/src\/api(?:\.js)?(?:\?.*)?$/,async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace(/const E2E_MOCK = [^;]+;/,'const E2E_MOCK = false;')});});
 await page.route(/\/src\/supabaseClient(?:\.js)?(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:`window.calls=[];window.failed=false;export const supabase={rpc:async(name,args)=>{window.calls.push({name,args});return window.failed?{error:{message:'network unavailable'}}:{data:'iq',error:null};}};`}));
 await mount(page,`window.api=await import('/src/api');window.ready=true;`);await page.waitForFunction(()=>window.ready);
 const result=await page.evaluate(async()=>{const initial=await window.api.getEventCompetitionProgram('one');window.failed=true;const offline=await window.api.getEventCompetitionProgram('one');let isolated=false;try{await window.api.getEventCompetitionProgram('two');}catch{isolated=true;}return {initial,offline,isolated,calls:window.calls};});
 expect(result.initial.value.program).toBe('iq');expect(result.offline).toEqual(result.initial);expect(result.isolated).toBe(true);expect(result.calls[0]).toEqual({name:'get_event_competition_program',args:{p_event:'one'}});
});

test('actual TM IQ CSV previews numeric partners and imports unscored matches',async({page})=>{
 await mount(page,`window.imported=null;ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(IQ.default,{canEdit:true,parseCSV:text=>text.trim().split(/\\r?\\n/).map(line=>line.split(',')),onImport:async rows=>{window.imported=rows;}}));`);
 await page.getByLabel('Import IQ schedule / results',{exact:false}).setInputFiles(fileURLToPath(new URL('./fixtures/iq-tm-matches.csv',import.meta.url)));
 await expect(page.getByRole('heading',{name:'Review 24 IQ matches',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'IQ import preview'}).getByText(/Q1 · 7 \+ 9/)).toBeVisible();
 await page.getByRole('button',{name:'Apply IQ matches',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.imported?.length)).toBe(24);
 expect(await page.evaluate(()=>window.imported.every(m=>m.red.length===2&&m.blue.length===0&&m.redScore===undefined))).toBe(true);
});
