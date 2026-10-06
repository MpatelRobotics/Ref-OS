import {test,expect} from '@playwright/test';
test('scheduler is available inside the real Judging tab',async({page,isMobile})=>{
 await page.route('https://example.supabase.co/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 await page.route('**/src/interviewScheduleApi*',r=>r.fulfill({contentType:'text/javascript',body:'export const loadInterviewSchedule=async()=>({value:{duration:10,entries:[]},version:0});export const saveInterviewSchedule=async()=>({version:1});'}));
 await page.goto('/');await page.getByRole('button',{name:/Highlander Summit/}).first().click();await page.getByRole('button',{name:'Admin login',exact:true}).click();await page.getByPlaceholder('Admin password').fill('test-judge');await page.getByRole('button',{name:'Enter',exact:true}).click();await page.getByPlaceholder('e.g. Maharshi').fill('InterviewTester');await page.getByPlaceholder('Required for exports').nth(0).fill('Interview');await page.getByPlaceholder('Required for exports').nth(1).fill('Tester');await page.getByRole('button',{name:'Start logging',exact:true}).click();await page.getByRole('button',{name:'Close Quick Start'}).click();
 await page.getByRole('navigation',{name:isMobile?'Mobile navigation':'Main navigation',exact:true}).getByRole('button',{name:'Judging',exact:true}).click();
 await expect(page.getByRole('region',{name:'Experimental Interview Scheduler'})).toBeVisible();await expect(page.getByLabel('Interview length (minutes)',{exact:true})).toBeEnabled();
});
async function mount(page,fail=false){
 await page.route('**/src/interviewScheduleApi*',r=>r.fulfill({contentType:'text/javascript',body:'export const loadInterviewSchedule=async()=>({value:{duration:10,entries:[]},version:0});export const saveInterviewSchedule=async()=>({version:1});'}));
 await page.route('**/interview-test',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
 import '/src/index.css';import '/@vite/client';import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default;const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const Scheduler=(await import('/src/components/InterviewScheduler.jsx')).default;
 window.saved=[];let value={duration:10,entries:[]};let version=0;const api={loadInterviewSchedule:async()=>({value,version}),saveInterviewSchedule:async(event,session,next,expected)=>{window.saved.push({event,session,next,expected});if(${fail})throw Error('Another organizer changed this schedule. Reload saved schedule before making more changes. Your draft is still here.');value=next;version++;return {value,version};}};
 ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Scheduler,{eventId:'event-one',sessionId:'session-one',sessionName:'Session 1',teams:[{number:'10A',name:'Ten'},{number:'2A',name:'Two'}],api}));
 </script></body></html>`}));await page.goto('/interview-test');await expect(page.getByRole('button',{name:'Select unscheduled teams'})).toBeEnabled();
}
async function generate(page){await page.getByLabel('Interview length (minutes)',{exact:true}).fill('15');await page.getByLabel('First interview time').fill('2026-10-06T09:00');await page.getByRole('button',{name:'Select unscheduled teams'}).click();await page.getByRole('button',{name:'Add selected interviews'}).click();}
test('experimental scheduler saves configurable interview slots in the selected League session',async({page})=>{
 await mount(page);await expect(page.getByText('Experimental',{exact:true})).toBeVisible();await generate(page);await expect(page.getByLabel('Length (minutes)',{exact:true}).first()).toHaveValue('15');await page.getByRole('button',{name:'Save interview schedule'}).click();await expect(page.getByRole('status')).toContainText('schedule saved');
 const saved=await page.evaluate(()=>window.saved[0]);expect(saved.event).toBe('event-one');expect(saved.session).toBe('session-one');expect(saved.next.entries.map(row=>row.team)).toEqual(['2A','10A']);expect(Date.parse(saved.next.entries[1].start)-Date.parse(saved.next.entries[0].start)).toBe(900000);
 await page.getByRole('button',{name:'Reload saved schedule'}).click();await expect(page.getByText('Team 2A',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('overlap prevents saving and can be resolved by editing the panel',async({page})=>{
 await mount(page);await generate(page);await page.getByLabel('Length (minutes)',{exact:true}).first().fill('20');await expect(page.getByRole('alert')).toContainText('overlap');await expect(page.getByRole('button',{name:'Save interview schedule'})).toBeDisabled();await page.getByLabel('Panel/location',{exact:true}).nth(2).fill('Judge panel 2');await expect(page.getByRole('button',{name:'Save interview schedule'})).toBeEnabled();
});
test('concurrent-save failure keeps the draft visible instead of replacing shared data',async({page})=>{
 await mount(page,true);await generate(page);await page.getByRole('button',{name:'Save interview schedule'}).click();await expect(page.getByRole('alert')).toContainText('Another organizer');await expect(page.getByText('Team 2A',{exact:true})).toBeVisible();await expect(page.getByText(/Unsaved changes/)).toBeVisible();
});
