import {test,expect} from '@playwright/test';
test('referee can save a profile and mark event plans on mobile',async({page})=>{
 await page.route('**/src/refereePortalApi*',r=>r.fulfill({contentType:'text/javascript',body:`export async function accountUser(){return {id:'account',email:'alex@example.org'}};export async function loadRefereeProfile(){return {profile:{full_name:'Alex Smith'},plans:[]}};export async function saveRefereeProfile(id,value){window.savedProfile=value};export async function saveEventPlan(id,event,attendance){window.savedPlan={event,attendance}};`}));
 await page.route('**/src/api*',r=>r.fulfill({contentType:'text/javascript',body:`export async function listSelectableEvents(){return [{id:'event',name:'Example tournament'}]};`}));
 await page.route('**/referee-test',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">import '/src/index.css';import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,View=(await import('/src/components/RefereePortal.jsx')).default;DOM.createRoot(document.getElementById('root')).render(React.createElement(View,{onClose:()=>{}}));</script>`}));
 await page.setViewportSize({width:390,height:844});await page.goto('/referee-test');
 await page.getByLabel('Country',{exact:true}).fill('United States');await page.getByLabel('Phone',{exact:true}).fill('555-0100');
 await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.savedProfile?.country)).toBe('United States');
 await page.getByLabel('Attendance for Example tournament').selectOption('going');
 await expect.poll(()=>page.evaluate(()=>window.savedPlan?.attendance)).toBe('going');
 await expect(page.getByRole('heading',{name:'Events I’m going to'}).locator('..')).toContainText('Example tournament');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('new referee accounts show email confirmation before profile access',async({page})=>{
 await page.route('**/src/refereePortalApi*',r=>r.fulfill({contentType:'text/javascript',body:`export async function accountUser(){return null};export async function loadRefereeProfile(){};export async function saveRefereeProfile(){};export async function saveEventPlan(){};`}));
 await page.route('**/src/supabaseClient*',r=>r.fulfill({contentType:'text/javascript',body:`export const supabase={auth:{signUp:async values=>{window.signupEmail=values.email;return {data:{session:null},error:null}}}};`}));
 await page.route('**/src/api*',r=>r.fulfill({contentType:'text/javascript',body:`export async function listSelectableEvents(){return []};`}));
 await page.route('**/referee-auth-test',r=>r.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,View=(await import('/src/components/RefereePortal.jsx')).default;DOM.createRoot(document.getElementById('root')).render(React.createElement(View,{onClose:()=>{}}));</script>`}));
 await page.goto('/referee-auth-test');await page.getByRole('button',{name:'Create account',exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill('newref@example.org');await page.getByLabel('Password',{exact:true}).fill('Example-password-123');
 await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Check your email');
 expect(await page.evaluate(()=>window.signupEmail)).toBe('newref@example.org');
 await expect(page.getByRole('heading',{name:'My profile',exact:true})).toHaveCount(0);
});
