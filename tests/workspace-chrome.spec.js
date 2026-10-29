import {test,expect} from '@playwright/test';
async function mockIQApp(page,role="admin",program="iq"){
 await page.route('https://example.supabase.co/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 await page.route(/\/src\/api(?:\.js)?(?:\?.*)?$/,async r=>{
  const res=await r.fetch();let source=await res.text();
  source=source.replace('name: "Highlander Summit", branding: {}','name: "IQ Fixture", branding: {}').replace('11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999');
  source=source.replace('const e2eState = { teams: [], violations: [] };','const e2eState = { teams: [{number:"123A",name:"Partner One",rank:1,photoKeys:[]},{number:"456B",name:"Partner Two",rank:2,photoKeys:[]}], violations: [] };');
  source=source.replace('name: "Highlander Summit E2E"','name: "IQ Fixture"');
  source=source.replace('export async function getMyEventAccess(eventId) {','export async function getMyEventAccess(eventId) { if(E2E_MOCK) return {role:"'+role+'",developer:false};');
  source=source.replace('export async function getEventCompetitionProgram(eventId) {','export async function getEventCompetitionProgram(eventId) { if(E2E_MOCK) return {key:"competition_program",value:{program:"'+program+'"}};');
  source=source.replace('export async function listEventSettings(eventId) {','export async function listEventSettings(eventId) { if(E2E_MOCK) return {competition_program:{value:{program:"'+program+'"}},qualification_records:{value:{records:{"123A":{avgPoints:42,played:4},"456B":{avgPoints:38,played:4}}}}};');
  source=source.replace(/export async function listMatches\(eventId[^\n]+\{\r?\n/,'export async function listMatches(eventId) { if(E2E_MOCK) return [{id:"1",phase:"qual",num:1,red:["123A","456B"],blue:[],redScore:42,blueScore:null,field:"Field 1"}];');
  await r.fulfill({response:res,body:source});
 });
 await page.goto('/');await page.getByRole('button',{name:/IQ Fixture/}).first().click();

 await page.getByPlaceholder('e.g. Maharshi').fill('IQTester');await page.getByPlaceholder('Required for exports').nth(0).fill('IQ');await page.getByPlaceholder('Required for exports').nth(1).fill('Tester');await page.getByRole('button',{name:'Start logging',exact:true}).click();await page.getByRole('button',{name:'Close Quick Start'}).click();
}

test('compact neutral desktop navigation and flat team rows',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await mockIQApp(page);
 const nav=page.getByRole('navigation',{name:'Main navigation'});
 await expect(nav).toHaveCSS('width','176px');
 await expect(nav).toHaveCSS('background-color','rgb(248, 250, 252)');
 await expect(page.locator('.refos-header')).toHaveCSS('background-color','rgb(255, 255, 255)');
 await page.locator('.refos-header-event > button').hover();
 await expect(page.locator('.refos-header-event > button')).toHaveCSS('color','rgb(82, 97, 118)');
 await expect(page.locator('.refos-header-event > button')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');

 await page.getByRole('button',{name:'Teams',exact:true}).click();
 await expect(nav.getByRole('button',{name:'Teams',exact:true})).toHaveAttribute('aria-current','page');
 await expect(page.locator('.refos-team-list>li>button').first()).toHaveCSS('border-radius','0px');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/clean-workspace-desktop.png',fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Dark Mode',exact:true}).click();
 await expect(page.locator('.refos-header')).toHaveCSS('background-color','rgb(26, 38, 56)');
 await expect(nav.getByRole('button',{name:'Teams',exact:true})).toHaveCSS('background-color','rgb(23, 46, 76)');
 await expect(nav.getByRole('button',{name:'Teams',exact:true})).toHaveCSS('color','rgb(147, 197, 253)');
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.screenshot({path:'test-results/clean-workspace-dark.png',fullPage:true,animations:'disabled'});
});
test('mobile chrome stays neutral, readable and within viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await mockIQApp(page);
 await expect(page.locator('.refos-header')).toHaveCSS('background-color','rgb(255, 255, 255)');
 await expect(page.locator('.refos-mobile-bottom')).toHaveCSS('background-color','rgb(255, 255, 255)');
 const box=await page.getByRole('heading',{name:'IQ Fixture',exact:true}).boundingBox();expect(box.y).toBeGreaterThanOrEqual(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/clean-workspace-mobile.png',fullPage:true,animations:'disabled'});
});

for(const [program,color,border] of [['iq','rgb(30, 64, 175)','rgb(191, 219, 254)'],['v5','rgb(153, 27, 27)','rgb(254, 202, 202)']]){
 test(program+' program accents color headings and borders without recoloring IQ partner identities',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await mockIQApp(page,'admin',program);
  await expect(page.locator('.refos-shell')).toHaveAttribute('data-program',program);
  await expect(page.locator('.refos-page-heading h2')).toHaveCSS('color',color);
  await expect(page.locator('.refos-header')).toHaveCSS('border-bottom-color',border);
  await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Matches',exact:true})).toHaveCSS('color',color);
  await page.screenshot({path:'test-results/program-'+program+'-desktop.png',fullPage:true,animations:'disabled'});
 });
}

test('unscheduled-team boxes retain colored borders but use the neutral page background',async({page})=>{
 await page.route('**/neutral-boxes-test',r=>r.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import '/src/index.css';import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,View=(await import('/src/components/UnscheduledTeams.jsx')).default;DOM.createRoot(document.getElementById('root')).render(React.createElement('div',{className:'refos-shell','data-program':'v5'},React.createElement('main',{className:'refos-workspace'},React.createElement(View,{teams:[{number:'4265P',name:'Over-Powered'}],onOpen:()=>{}}))));</script>`}));
 await page.goto('/neutral-boxes-test');await page.getByText('Not in match list (1)',{exact:true}).click();
 const section=page.locator('details');
 await expect(section).toHaveCSS('background-color','rgb(248, 250, 252)');
 await expect(section).toHaveCSS('border-top-color','rgb(254, 202, 202)');
 await expect(page.getByRole('button',{name:/4265P.*Over-Powered/})).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 await page.evaluate(()=>document.documentElement.classList.add('dark'));
 await expect(section).toHaveCSS('background-color','rgb(16, 24, 39)');
 await expect(section).toHaveCSS('border-top-color','rgb(107, 52, 63)');
});
