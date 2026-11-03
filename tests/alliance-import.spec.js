import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { transformSync } from 'esbuild';
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const start = source.indexOf('function AllianceSelection(');
const component = source.slice(start, source.indexOf('function AddMatchModal(', start));
const compiled = transformSync(`import React from '/node_modules/.vite/deps/react.js';
const {useState,useEffect}=React;
import {tmMatchOrder} from '/src/tmMatchIdentity.js';
import {eliminationPairingKey,eliminationPairingLabel,eliminationResultLabel} from '/src/tmReplayGrouping.js';
import {tmMatchHighlights} from '/src/tmMatchHighlights.js';
const TmFieldActivity=()=>null;
const GitBranch = () => null, Check = () => null, Trophy = () => null;
const fmtMatch = m => m.phase + ' ' + m.num;
${component}
export default AllianceSelection;`, {loader:'jsx',format:'esm'}).code;
async function mount(page, {canImport=true, canEditBracket=true, phase='r16', empty=false, finalsBestOf=1, finalWins=0, live=false, replay=false} = {}) {
  await page.route('**/alliance-test-component.js', route => route.fulfill({contentType:'text/javascript',body:compiled}));
  await page.route('**/alliance-import-test', route => route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
    import React from '/node_modules/.vite/deps/react.js';
    import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
    import Alliances from '/alliance-test-component.js';
    window.importClicks=0; window.selectedWinner=null;
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Alliances, {
      matches: ${JSON.stringify(replay?{'qf-2':{id:'qf-2',phase:'qf',num:2,red:['1A','2B'],blue:['3C','4D'],redScore:0,blueScore:0,winner:'double_dq'},'qf-1002':{id:'qf-1002',phase:'qf',num:1002,red:['1A','2B'],blue:['3C','4D'],redScore:8,blueScore:8,winner:'tie'}}:empty?{}:phase==='final'?Object.fromEntries([1,2,3].map(num=>['final-'+num,{id:'final-'+num,phase,num,red:['1A','2B'],blue:['3C','4D'],winner:num<=finalWins?'red':''}])):{test:{id:'test',phase,num:1,red:['1A','2B'],blue:['3C','4D']}})},
      tmActivity: ${live ? JSON.stringify({updatedAt:Date.now(),fieldSets:[{connected:true,fields:[{status:'playing',match:{round:'QF',instance:1,match:1}}]}]}) : 'null'},
      onOpenMatch:id=>window.openedMatch=id,
      finalsBestOf:${finalsBestOf},canImport:${canImport},canEditBracket:${canEditBracket},
      onImport:()=>window.importClicks++,onSetWinner:(match,side)=>window.selectedWinner={id:match.id,side}
    }));
  </script></body></html>`}));
  await page.goto('/alliance-import-test');
}
test('import replaces manual picking and instructions explain the TM file', async ({page}) => {
  await mount(page);
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByText('Match List and Results', {exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Import Alliances',exact:true}).click();
  expect(await page.evaluate(()=>window.importClicks)).toBe(1);
  await page.getByRole('button',{name:'1A 2B',exact:true}).click();
  expect(await page.evaluate(()=>window.selectedWinner)).toEqual({id:'test',side:'red'});
});
test('view-only users cannot import or select winners', async ({page}) => {
  await mount(page,{canImport:false,canEditBracket:false});
  await expect(page.getByRole('button',{name:'Import Alliances',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'1A 2B',exact:true})).toBeDisabled();
});
test('later-round bracket remains visible without Round of 16', async ({page}) => {
  await mount(page,{phase:'qf'});
  await expect(page.getByRole('heading',{name:'Quarterfinals',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'1A 2B',exact:true})).toBeEnabled();
});
test('empty bracket provides an import starting point', async ({page}) => {
  await mount(page,{empty:true});
  await expect(page.getByText('No elimination bracket loaded yet.',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Import Alliances',exact:true})).toBeVisible();
});

test('best of 1 keeps additional final games visible and names champion after one win', async ({page}) => {
  await mount(page,{phase:'final',finalsBestOf:1,finalWins:1});
  await expect(page.getByRole('heading',{name:'Finals (best of 1)',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'1A 2B',exact:true})).toHaveCount(3);
  await expect(page.getByText('Champion alliance:',{exact:false})).toContainText('1A 2B');
  await expect(page.getByText('Final 2',{exact:true})).toHaveCount(1);
});
test('best of 3 shows three finals and needs two wins', async ({page}) => {
  await mount(page,{phase:'final',finalsBestOf:3,finalWins:1});
  await expect(page.getByRole('heading',{name:'Finals (best of 3)',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'1A 2B',exact:true})).toHaveCount(3);
  await expect(page.getByText('Champion alliance:',{exact:false})).toHaveCount(0);
  await mount(page,{phase:'final',finalsBestOf:3,finalWins:2});
  await expect(page.getByText('Champion alliance:',{exact:false})).toContainText('1A 2B');
});
test('automatic advancement creates the configured number of finals',async()=>{
 const {planBracketCorrection}=await import('../src/bracketCorrection.js');
 const one={id:'sf-1',phase:'sf',num:1,winner:'red',red:['1A','2B'],blue:['5E','6F']};
 const two={id:'sf-2',phase:'sf',num:2,winner:'blue',red:['7G','8H'],blue:['3C','4D']};
 const map={'sf-1':one,'sf-2':two};
 for(const count of [1,3])expect(planBracketCorrection(map,one,'red',count).changes.filter(m=>m.phase==='final').map(m=>m.num)).toEqual(Array.from({length:count},(_,i)=>i+1));
});

test('elimination bracket highlights live match and only jumps on request', async ({page}) => {
  await mount(page,{phase:'qf',live:true});
  await expect(page.getByText('Playing now',{exact:true})).toBeVisible();
  await expect(page.getByText('Playing now',{exact:true}).locator('..')).toHaveClass(/ring-emerald-500/);
  expect(await page.evaluate(()=>window.openedMatch)).toBeUndefined();
  await page.getByRole('button',{name:'Jump to current match · qf 1'}).click();
  expect(await page.evaluate(()=>window.openedMatch)).toBe('test');
});

test('replays share one pairing heading and preserve double DQ and tie labels',async({page})=>{
 await mount(page,{replay:true});
 await expect(page.getByRole('heading',{name:'QF-2',exact:true})).toHaveCount(1);
 await expect(page.getByText('Score 0 – 0 · Double DQ',{exact:true})).toBeVisible();
 await expect(page.getByText('Score 8 – 8 · Tie',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Clear double DQ',exact:true}).click();
 expect(await page.evaluate(()=>window.selectedWinner)).toEqual({id:'qf-2',side:'double_dq'});
});

test('ladder connects round columns and keeps future pairings visible on mobile', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await mount(page);
  await expect(page.getByRole('region',{name:'Scrollable elimination bracket ladder'})).toBeVisible();
  await page.addStyleTag({content:readFileSync('dist/assets/'+readdirSync('dist/assets').find(name=>name.endsWith('.css')),'utf8')});
  const ladder=page.getByRole('region',{name:'Scrollable elimination bracket ladder'});
  await expect(ladder.locator('.refos-bracket-round')).toHaveCount(4);
  await expect(page.getByText('Winner of R16-1',{exact:true})).toBeVisible();
  expect(await ladder.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/bracket-ladder-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'test-results/bracket-ladder-desktop.png',fullPage:true});
});
