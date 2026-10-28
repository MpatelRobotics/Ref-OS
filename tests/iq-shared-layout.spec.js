
import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const source=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const list=source.slice(source.indexOf('function MatchList('),source.indexOf('function AwpStep('));
const detail=source.slice(source.indexOf('function MatchDetail('),source.indexOf('\nfunction ',source.indexOf('function MatchDetail(')+10));
const stubs=[...new Set([...list.matchAll(/<([A-Z][A-Za-z0-9]*)/g),...detail.matchAll(/<([A-Z][A-Za-z0-9]*)/g)].map(m=>m[1]))].filter(name=>!['React','Empty'].includes(name)).map(name=>'const '+name+'=()=>null;').join('\n');
const compiled=transformSync(`import React from '/node_modules/.vite/deps/react.js';import {iqTeams,iqStartingPosition} from '/src/iq/iqWorkflows.js';const {useState,useEffect,useContext}=React;const LeagueUiContext=React.createContext(null),DEFAULT_FIELD_NAMES={},ORDER=[],TYPES={};const tmMatchHighlights=()=>({}),tmMatchOrder=(a,b)=>a.num-b.num,eliminationPairingKey=()=>null,eliminationResultLabel=()=>'',fieldDisplayName=f=>f,fmtMatch=m=>m.phase==='final'?'F'+m.num:m.phase==='practice'?'P'+m.num:'Q'+m.num,splitRuleCodes=()=>[],fmtRule=c=>c,fmtTime=()=>'';const Empty=({title})=><p>{title}</p>;${stubs}
${list}
${detail}
export {MatchList,MatchDetail};`,{loader:'jsx',format:'esm'}).code;
async function mount(page,mode='detail',iq=true){
 await page.route('**/shared-layout.js',r=>r.fulfill({contentType:'text/javascript',body:compiled}));
 await page.route('**/iq-shared-test',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">import '/src/index.css';import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,Views=await import('/shared-layout.js');window.logs=[];window.nav=[];const match={id:'1',phase:'qual',num:1,red:['7','9'],blue:${iq?'[]':"['18','24']"},redScore:42,blueScore:${iq?'null':'35'},field:'Main Field'},matches={'1':match,'2':{...match,id:'2',num:2}},props={isIQ:${iq},match,matches,teamName:{'7':'Seven','9':'Nine'},teamRank:{'7':1},viols:[],fieldLog:[],query:'',setQuery:()=>{},onOpen:id=>window.nav.push(id),onNav:id=>window.nav.push(id),onLogTeam:n=>window.logs.push(n),onAddField:async e=>window.logs.push(e),onRemoveField:async()=>{}};DOM.createRoot(document.getElementById('root')).render(React.createElement(Views.${mode==='list'?'MatchList':'MatchDetail'},props));</script>`}));
 await page.goto('/iq-shared-test');
}
test('shared detail adapts IQ partners and score while removing scoring aid and V5 operations',async({page})=>{
 await page.setViewportSize({width:390,height:844});await mount(page);
 await expect(page.getByText('Teamwork partners',{exact:true})).toBeVisible();
 await expect(page.getByText('Team 1 · Blue Pyramid Goal side',{exact:true})).toHaveCSS('color','rgb(29, 78, 216)');
 await expect(page.getByText('Team 2 · Red Pyramid Goal side',{exact:true})).toHaveCSS('color','rgb(185, 28, 28)');
 await expect(page.getByText('Shared score: 42',{exact:true})).toBeVisible();
 for(const text of ['Level Up scoring aid','Referee quick checks','Red alliance','Blue alliance'])await expect(page.getByText(text,{exact:true})).toHaveCount(0);
 for(const text of ['AWP check','Timeout','Save shared score'])await expect(page.getByRole('button',{name:text,exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:/7.*Seven/}).click();expect(await page.evaluate(()=>window.logs)).toEqual(['7']);
 await page.getByRole('button',{name:'Next',exact:false}).click();expect(await page.evaluate(()=>window.nav)).toEqual(['2']);
 await page.getByRole('button',{name:'Field fault',exact:true}).click();await page.getByPlaceholder('What happened? (optional)').fill('Sample field fault');
 await page.getByRole('button',{name:'Log field fault',exact:true}).click();expect(await page.evaluate(()=>window.logs.at(-1).kind)).toBe('field_fault');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('shared IQ list uses partners and shared scores rather than opposing alliances',async({page})=>{
 await mount(page,'list');await expect(page.getByText('7 + 9',{exact:true})).toHaveCount(2);await expect(page.getByText('Shared score: 42',{exact:true})).toHaveCount(2);await expect(page.getByText('vs',{exact:true})).toHaveCount(0);await expect(page.getByText('Awaiting score',{exact:true})).toHaveCount(0);
});
test('V5 detail retains alliances and AWP controls',async({page})=>{
 await mount(page,'detail',false);await expect(page.getByText('Red alliance',{exact:true})).toBeVisible();await expect(page.getByText('Blue alliance',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'AWP check',exact:true})).toBeVisible();await expect(page.getByText('Teamwork partners',{exact:true})).toHaveCount(0);
});
