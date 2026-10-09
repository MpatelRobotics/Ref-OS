import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const start = source.indexOf('function AllianceSelection(');
const component = source.slice(start, source.indexOf('function AddMatchModal(', start));
const compiled = transformSync(`import React from '/node_modules/.vite/deps/react.js';
const {useState,useEffect}=React;
import {tmMatchOrder} from '/src/tmMatchIdentity.js';
import {tmMatchHighlights} from '/src/tmMatchHighlights.js';
const TmFieldActivity=()=>null;
const GitBranch = () => null, Check = () => null, Trophy = () => null;
const fmtMatch = m => m.phase + ' ' + m.num;
${component}
export default AllianceSelection;`, {loader:'jsx',format:'esm'}).code;
async function mount(page, {canImport=true, canEditBracket=true, phase='r16', empty=false, finalsBestOf=1, finalWins=0, live=false} = {}) {
  await page.route('**/alliance-test-component.js', route => route.fulfill({contentType:'text/javascript',body:compiled}));
  await page.route('**/alliance-import-test', route => route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
    import React from '/node_modules/.vite/deps/react.js';
    import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
    import Alliances from '/alliance-test-component.js';
    window.importClicks=0; window.selectedWinner=null;
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Alliances, {
      matches: ${JSON.stringify(empty?{}:phase==='final'?Object.fromEntries([1,2,3].map(num=>['final-'+num,{id:'final-'+num,phase,num,red:['1A','2B'],blue:['3C','4D'],winner:num<=finalWins?'red':''}])):{test:{id:'test',phase,num:1,red:['1A','2B'],blue:['3C','4D']}})},
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

test('best of 1 shows one final and names champion after one win', async ({page}) => {
  await mount(page,{phase:'final',finalsBestOf:1,finalWins:1});
  await expect(page.getByRole('heading',{name:'Finals (best of 1)',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'1A 2B',exact:true})).toHaveCount(1);
  await expect(page.getByText('Champion alliance:',{exact:false})).toContainText('1A 2B');
  await expect(page.getByText('Final 2',{exact:true})).toHaveCount(0);
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
  const start=source.indexOf('  const advanceBracket = async (map) =>');
  const fn=source.slice(start,source.indexOf('  const setMatchWinner =',start));
  const run=new Function('event','map',`return (async()=>{const created=[];const api={addMatch:async(_,match)=>created.push(match)};const eventId='test';const reloadMatches=async()=>{};const winnerTeams=m=>m&&m.winner?(m.winner==='red'?m.red:m.blue):null;${fn}await advanceBracket(map);return created;})();`);
  const map={'sf-1':{winner:'red',red:['1A','2B'],blue:[]},'sf-2':{winner:'blue',red:[],blue:['3C','4D']}};
  expect((await run({finalsBestOf:1},map)).filter(m=>m.phase==='final').map(m=>m.num)).toEqual([1]);
  expect((await run({finalsBestOf:3},map)).filter(m=>m.phase==='final').map(m=>m.num)).toEqual([1,2,3]);
});


test('elimination bracket highlights live match and only jumps on request', async ({page}) => {
  await mount(page,{phase:'qf',live:true});
  await expect(page.getByText('Playing now',{exact:true})).toBeVisible();
  await expect(page.getByText('Playing now',{exact:true}).locator('..')).toHaveClass(/bg-emerald-50/);
  expect(await page.evaluate(()=>window.openedMatch)).toBeUndefined();
  await page.getByRole('button',{name:'Jump to current match · qf 1'}).click();
  expect(await page.evaluate(()=>window.openedMatch)).toBe('test');
});
