import {test,expect} from '@playwright/test';
import {transformSync} from 'esbuild';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const component=source.slice(source.indexOf('function MatchList('),source.indexOf('\nfunction AwpStep('));
for(const iq of [false,true])test(`Practice is separate from qualifications and eliminations (${iq?'IQ':'V5'})`,async({page})=>{
 const fixture=transformSync(`import React from '/node_modules/.vite/deps/react.js';import DOM from '/node_modules/.vite/deps/react-dom_client.js';
const {useState,useEffect}=React;const DEFAULT_FIELD_NAMES={},tmMatchHighlights=()=>({}),tmMatchOrder=(a,b)=>a.num-b.num,fmtMatch=m=>m.phase==='practice'?'P'+m.num:'Final'+m.num,eliminationPairingKey=m=>m.phase,eliminationPairingLabel=m=>m.phase,fieldDisplayName=x=>x,iqTeams=m=>m.red,iqStartingPosition=()=>({}),eliminationResultLabel=()=>'',isEliminationMatch=m=>m.phase==='final';
const Icon=()=>null,ScheduledMatchTime=Icon,Search=Icon,Plus=Icon,RefreshCw=Icon,ChevronRight=Icon,Empty=({title})=>React.createElement('p',null,title);
${component}
const matches={q:{id:'q',phase:'qual',num:1,red:['1A'],blue:['2A']},p:{id:'p',phase:'practice',num:1,red:['3A'],blue:['4A']},f:{id:'f',phase:'final',num:1,red:['5A'],blue:['6A']}};
DOM.createRoot(document.getElementById('root')).render(React.createElement(MatchList,{isIQ:${iq},matches,viols:[],query:'',setQuery:()=>{},onOpen:()=>{},teamName:()=>'',canAdd:true}));`,{loader:'jsx',format:'esm'}).code;
 await page.route('**/practice-test',r=>r.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">${fixture}</script>`}));
 page.on('pageerror',e=>console.log(e.message));
 await page.goto('/practice-test');
 await page.getByRole('button',{name:'Practice',exact:true}).click();
 await expect(page.locator('.refos-match-list')).toContainText('P1');await expect(page.locator('.refos-match-list')).not.toContainText('Q1');await expect(page.getByRole('button',{name:'Add elimination match'})).toHaveCount(0);
 await page.getByRole('button',{name:'Qualifications',exact:true}).click();await expect(page.locator('.refos-match-list')).toContainText('Q1');await expect(page.locator('.refos-match-list')).not.toContainText('P1');
 if(!iq){await page.getByRole('button',{name:'Eliminations',exact:true}).click();await expect(page.locator('.refos-match-list')).not.toContainText('P1');await expect(page.locator('.refos-match-list')).toContainText('Final1');}
});
