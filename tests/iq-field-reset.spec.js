
import {test,expect} from '@playwright/test';
async function mount(page,readonly=false){
 await page.route('**/iq-reset-test',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">import '/src/index.css';import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,View=(await import('/src/features/field-reset/IQFieldReset.jsx')).default;window.saved={};window.fail=false;window.calls=[];function App(){const[version,refresh]=React.useState(0),[match,setMatch]=React.useState('Q1');window.switchMatch=()=>setMatch('Q2');return React.createElement(View,{key:match,matchLabel:match,meName:'Ref One',canVerify:${!readonly},checks:window.saved[match]||[],onClose:()=>window.closed=true,onVerify:async area=>{if(window.fail)throw Error('Connection unavailable');window.calls.push({match,area});window.saved[match]=[...(window.saved[match]||[]),{quadrant:area,verifiedBy:'Ref One',verifiedAt:Date.now()}];refresh(version+1);},onReset:async()=>{window.saved[match]=[];refresh(version+1);}});}DOM.createRoot(document.getElementById('root')).render(React.createElement(App));</script>`}));
 await page.goto('/iq-reset-test');await expect(page.getByRole('heading',{name:'IQ Field Reset · Q1',exact:true})).toBeVisible();
}
test('IQ diagram, four shared match checks, reset confirmation and match isolation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await mount(page);
 const image=page.getByRole('img',{name:/IQ Level Up field reset reference/});
 await expect(image).toBeVisible();expect(await image.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
 await page.getByRole('button',{name:'Enlarge IQ field reference',exact:true}).click();await expect(page.getByRole('dialog',{name:'IQ field reference',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close reference',exact:true}).click();
 for(const area of ['top left','top right','bottom left','bottom right'])await page.getByRole('button',{name:'Verify '+area+' area',exact:true}).click();
 await expect(page.getByRole('heading',{name:'FIELD READY',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.calls.map(c=>c.area))).toEqual([1,2,3,4]);
 await expect(page.getByText(/Verified by Ref One/)).toBeVisible();
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Reset',exact:true}).click();
 await expect(page.getByRole('heading',{name:'FIELD READY',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/iq-field-reset-mobile.png',fullPage:true,animations:'disabled'});
 await page.evaluate(()=>window.switchMatch());
 await expect(page.getByRole('heading',{name:'IQ Field Reset · Q2',exact:true})).toBeVisible();
 await expect(page.getByText(/0\/4 areas verified/)).toBeVisible();
 await page.getByRole('button',{name:'Verify top left area',exact:true}).click();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Reset',exact:true}).click();
 await expect(page.getByText(/0\/4 areas verified/)).toBeVisible();
 expect(await page.evaluate(()=>window.saved.Q1.length)).toBe(4);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('failed IQ reset save stays unverified and can be retried',async({page})=>{
 await mount(page);await page.evaluate(()=>window.fail=true);await page.getByRole('button',{name:'Verify top left area',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveText('Connection unavailable');await expect(page.getByText(/0\/4 areas verified/)).toBeVisible();
 await page.evaluate(()=>window.fail=false);await page.getByRole('button',{name:'Verify top left area',exact:true}).click();await expect(page.getByText(/1\/4 areas verified/)).toBeVisible();
});
test('read-only IQ field checks allow viewing without verification or reset',async({page})=>{
 await mount(page,true);await expect(page.getByRole('img',{name:/IQ Level Up field reset reference/})).toBeVisible();await expect(page.getByRole('button',{name:/^Verify /})).toHaveCount(0);await expect(page.getByRole('button',{name:'Reset',exact:true})).toHaveCount(0);
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

test('IQ match opens the IQ field reset and saves its area through the match handler',async({page})=>{
 await mockIQApp(page);await page.getByRole('button',{name:/Q1.*123A \+ 456B/}).click();
 await page.getByRole('button',{name:/^Field reset/}).first().click();
 await expect(page.getByRole('heading',{name:'IQ Field Reset · Q1',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Verify top left area',exact:true}).click();
 await expect(page.getByText(/1\/4 areas verified/)).toBeVisible();
 await page.getByRole('button',{name:'Back',exact:true}).click();
 await expect(page.getByRole('button',{name:/^Field reset 1\/4/}).first()).toBeVisible();
});
