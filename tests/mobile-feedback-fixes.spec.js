import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const source=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const nomination=source.slice(source.indexOf('function NominateModal('),source.indexOf('function ActivityFeed('));
const alliance=source.slice(source.indexOf('function AllianceSelection('),source.indexOf('function AddMatchModal('));
const moduleCode=transformSync(`import React from '/node_modules/.vite/deps/react.js'; const {useState,useEffect,useMemo}=React;
import ReactDOM from '/node_modules/.vite/deps/react-dom.js'; const {createPortal}=ReactDOM;
const X=()=>null, Trophy=()=>null, UserCircle2=()=>null, Check=()=>null, GitBranch=()=>null;
const Label=({children})=><label>{children}</label>;
const AWARDS=[{key:'sportsmanship',full:'Sportsmanship',blurb:'',criteria:[]}];
const phaseCount=()=>0, availablePhases=()=>[{key:'none',label:'None'}], fmtMatch=m=>m.phase+m.num;
${nomination}
${alliance}
export {NominateModal,AllianceSelection};`,{loader:'jsx',format:'esm'}).code;
async function mount(page,kind){
 await page.route('**/mobile-test-module.js',r=>r.fulfill({contentType:'text/javascript',body:moduleCode}));
 await page.route('**/mobile-fixes-test',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
 import '/@vite/client'; import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default;
 const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
 await import('/src/index.css');
 const useMenuViewport=(await import('/src/useMenuViewport.js')).default;
 const {NominateModal,AllianceSelection}=await import('/mobile-test-module.js');
 const teams=Object.freeze([{number:'100A'},{number:'20B'},{number:'2Z'},{number:'20A'}]);window.savedNomination=null;
 function MenuTest(){const ref=React.useRef(null);useMenuViewport(ref,true);return React.createElement('div',{ref,className:'refos-menu-pop overflow-y-auto',style:{position:'absolute',top:100,right:16,width:224}},Array.from({length:24},(_,i)=>React.createElement('button',{key:i,style:{display:'block',width:'100%',height:44}},'Option '+i)));}
 const props={teams,me:{name:'Tester'},event:{},matches:{},onSave:v=>window.savedNomination=v,onClose:()=>{},onSetName:()=>{}};
 const matches={test:{id:'test',phase:'r16',num:1,red:['38301C','20025G'],blue:['99989T','2701Z']}};
 const element=${JSON.stringify(kind)}==='nomination'?React.createElement(NominateModal,props):${JSON.stringify(kind)}==='menu'?React.createElement(MenuTest):React.createElement('div',{className:'refos-shell'},React.createElement('nav',{className:'refos-desktop-nav flex'},Array.from({length:10},(_,i)=>React.createElement('button',{key:i},'Navigation '+i))),React.createElement('main',{className:'refos-workspace p-4'},React.createElement(AllianceSelection,{matches,canEditBracket:true,onSetWinner:()=>{},canImport:true,onImport:()=>{}})));
 ReactDOM.createRoot(document.getElementById('root')).render(element);
 </script></body></html>`}));await page.goto('/mobile-fixes-test');
}
test('nomination teams sort naturally and selected number is preserved on save',async({page})=>{
 await mount(page,'nomination');const select=page.getByRole('combobox',{name:'Team to nominate'});
 await expect(select.locator('option')).toHaveText(['2Z','20A','20B','100A']);
 await select.selectOption('20B');await page.getByPlaceholder('Briefly describe what the team did…').fill('Helped another team');
 await page.getByRole('button',{name:'Save nomination'}).click();
 expect((await page.evaluate(()=>window.savedNomination)).team).toBe('20B');
});
test('settings menu fits short viewport, scrolls to final option and resizes',async({page})=>{
 await page.setViewportSize({width:390,height:600});await mount(page,'menu');
 const menu=page.locator('.refos-menu-pop');await expect(menu).toBeVisible();
 await page.setViewportSize({width:844,height:390});
 await expect.poll(async()=>{const box=await menu.boundingBox();return box.y+box.height<=390;}).toBe(true);
 await menu.evaluate(el=>el.scrollTop=el.scrollHeight);
 const last=page.getByRole('button',{name:'Option 23',exact:true});await expect(last).toBeInViewport();
 await last.click();
});
test('landscape alliances fit screen and winner targets remain usable',async({page})=>{
 await page.setViewportSize({width:844,height:390});await mount(page,'alliances');
 await expect(page.getByRole('heading',{name:'Bracket',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const winner=page.getByRole('button',{name:'38301C 20025G',exact:true});await winner.scrollIntoViewIfNeeded();
 const box=await winner.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);await winner.click();
});


