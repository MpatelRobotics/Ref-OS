import {test,expect} from '@playwright/test';
async function mockIQApp(page,role="admin",program="iq",accent=null){
 await page.route('https://example.supabase.co/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 await page.route(/\/src\/api(?:\.js)?(?:\?.*)?$/,async r=>{
  const res=await r.fetch();let source=await res.text();
  source=source.replace('name: "Highlander Summit", branding: {}','name: "IQ Fixture", branding: {}').replace('11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999');
  source=source.replace('const e2eState = { teams: [], violations: [] };','const e2eState = { teams: [{number:"123A",name:"Partner One",rank:1,photoKeys:[]},{number:"456B",name:"Partner Two",rank:2,photoKeys:[]}], violations: [] };');
  source=source.replace('name: "Highlander Summit E2E"','name: "IQ Fixture"');
  source=source.replace('export async function getMyEventAccess(eventId) {','export async function getMyEventAccess(eventId) { if(E2E_MOCK) return {role:"'+role+'",developer:false};');
  source=source.replace('export async function getEventCompetitionProgram(eventId) {','export async function getEventCompetitionProgram(eventId) { if(E2E_MOCK) return {key:"competition_program",value:{program:"'+program+'"}};');
  source=source.replace('export async function listEventSettings(eventId) {','export async function listEventSettings(eventId) { if(E2E_MOCK) return {competition_program:{value:{program:"'+program+'"}},event_branding:{value:{accent:'+JSON.stringify(accent)+'}},qualification_records:{value:{records:{"123A":{avgPoints:42,played:4},"456B":{avgPoints:38,played:4}}}}};');
  source=source.replace(/export async function listMatches\(eventId[^\n]+\{\r?\n/,'export async function listMatches(eventId) { if(E2E_MOCK) return [{id:"1",phase:"qual",num:1,red:["123A","456B"],blue:[],redScore:42,blueScore:null,field:"Field 1"}];');
  await r.fulfill({response:res,body:source});
 });
 await page.goto('/');await page.getByRole('button',{name:/IQ Fixture/}).first().click();

 await page.getByPlaceholder('e.g. Maharshi').fill('IQTester');await page.getByPlaceholder('Required for exports').nth(0).fill('IQ');await page.getByPlaceholder('Required for exports').nth(1).fill('Tester');await page.getByRole('button',{name:'Start logging',exact:true}).click();await page.getByRole('button',{name:'Close Quick Start'}).click();
}


test('sidebar expands on hover and focus, collapses on selection and has no pin button',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await mockIQApp(page);
 const nav=page.getByRole('navigation',{name:'Main navigation'});
 await page.mouse.move(1000,700);await expect(nav).toHaveCSS('width','64px');
 await nav.hover();await expect(nav).toHaveCSS('width','224px');
 await expect(nav.getByRole('button',{name:/Keep navigation open|Expand navigation|Collapse navigation/})).toHaveCount(0);
 await nav.getByRole('button',{name:'Teams',exact:true}).click();await expect(nav).toHaveCSS('width','64px');
 await expect(nav.getByRole('button',{name:'Teams',exact:true})).toHaveAttribute('aria-current','page');
 await page.mouse.move(1000,700);await nav.hover();await expect(nav).toHaveCSS('width','224px');
 await page.locator('.refos-page-heading h2').click();await page.mouse.move(1000,700);await expect(nav).toHaveCSS('width','64px');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Dark Mode',exact:true}).click();
 await expect(page.locator('.refos-header')).toHaveCSS('background-color','rgb(20, 20, 20)');
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await nav.getByRole('button',{name:'Rules',exact:true}).focus();await expect(nav).toHaveCSS('width','224px');
});
test('mobile keeps touch navigation and safe viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await mockIQApp(page);
 await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeHidden();
 await expect(page.locator('.refos-mobile-bottom')).toBeVisible();
 const box=await page.getByRole('heading',{name:'IQ Fixture',exact:true}).boundingBox();expect(box.y).toBeGreaterThanOrEqual(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/supabase-workspace-mobile.png',fullPage:true,animations:'disabled'});
});
for(const [program,color] of [['iq','rgb(30, 64, 175)'],['v5','rgb(196, 61, 61)']]){
 test(program+' retains program identity with neutral borders',async({page})=>{
  await mockIQApp(page,'admin',program);
  await expect(page.locator('.refos-page-heading h2')).toHaveCSS('color',color);
  await expect(page.locator('.refos-header')).toHaveCSS('border-bottom-color','rgb(222, 222, 222)');
  await expect(page.locator('.refos-match-list')).toHaveCSS('border-radius','6px');
 });
}
test('saved event accent remains visible on the header',async({page})=>{
 await mockIQApp(page,'admin','v5','#7c3aed');
 await expect(page.locator('.refos-header-event h1')).toHaveCSS('color','rgb(124, 58, 237)');
 await expect(page.locator('.refos-header')).toHaveCSS('border-bottom-color','rgb(124, 58, 237)');
});
