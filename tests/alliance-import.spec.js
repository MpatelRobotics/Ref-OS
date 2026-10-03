import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const start = source.indexOf('function AllianceSelection(');
const component = source.slice(start, source.indexOf('function AddMatchModal(', start));
const compiled = transformSync(`import React from '/node_modules/.vite/deps/react.js';
const GitBranch = () => null, Check = () => null, Trophy = () => null;
const fmtMatch = (phase, num) => phase + ' ' + num;
${component}
export default AllianceSelection;`, {loader:'jsx',format:'esm'}).code;
async function mount(page, {canImport=true, canEditBracket=true, phase='r16', empty=false} = {}) {
  await page.route('**/alliance-test-component.js', route => route.fulfill({contentType:'text/javascript',body:compiled}));
  await page.route('**/alliance-import-test', route => route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
    import React from '/node_modules/.vite/deps/react.js';
    import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
    import Alliances from '/alliance-test-component.js';
    window.importClicks=0; window.selectedWinner=null;
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Alliances, {
      matches: ${JSON.stringify(empty?{}:{test:{id:'test',phase,num:1,red:['1A','2B'],blue:['3C','4D']}})},
      canImport:${canImport},canEditBracket:${canEditBracket},
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
