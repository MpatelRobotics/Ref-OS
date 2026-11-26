import {test,expect} from '@playwright/test';
async function mount(page,canEdit=true){
 const records=new Map();
 await page.route('https://example.supabase.co/rest/v1/event_operations*',route=>{
  const url=new URL(route.request().url());const team=JSON.parse(url.searchParams.get('payload').slice(3)).team;
  return route.fulfill({contentType:'application/json',body:JSON.stringify(records.has(team)?[records.get(team)]:[])});
 });
 await page.route('https://example.supabase.co/rest/v1/rpc/save_event_operation',async route=>{
  const args=route.request().postDataJSON();const team=args.p_payload.team;
  records.set(team,{id:team,version:(records.get(team)?.version||0)+1,payload:args.p_payload,event_id:args.p_event,session_id:args.p_session,division_id:args.p_division});
  await route.fulfill({contentType:'application/json',body:JSON.stringify(records.get(team))});
 });
 await page.route('**/robot-flags-test',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">import '/src/index.css';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,View=(await import('/src/components/RobotReferenceOptions.jsx')).default;function App(){const [team,setTeam]=React.useState('123A');return React.createElement(React.Fragment,null,React.createElement('button',{onClick:()=>setTeam(team==='123A'?'456B':'123A')},'Switch team'),React.createElement(View,{key:team,eventId:'event',team,canEdit:${canEdit},meName:'Inspector'}));}DOM.createRoot(document.getElementById('root')).render(React.createElement(App));</script>`}));
 await page.goto('/robot-flags-test');return records;
}
test('toggles persist independently per team with no photo requirement',async({page})=>{
 await page.setViewportSize({width:390,height:844});const records=await mount(page);
 const wall=page.getByRole('switch',{name:'Starts with zip tie touching wall'}),config=page.getByRole('switch',{name:'Multiple configurations or add-ons'});
 await expect(wall).toBeEnabled();await wall.check();await expect(page.getByText('Saved.',{exact:true})).toBeVisible();
 await config.check();await expect(config).toBeEnabled();expect(records.get('123A').payload.multiConfiguration).toBe(true);
 await page.getByRole('button',{name:'Switch team'}).click();await expect(wall).toBeEnabled();await expect(wall).not.toBeChecked();
 await page.getByRole('button',{name:'Switch team'}).click();await expect(wall).toBeEnabled();await expect(wall).toBeChecked();await expect(config).toBeChecked();
 await expect(page.getByText(/Pictures are optional/)).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('read-only roles cannot change robot reference toggles',async({page})=>{
 const records=await mount(page,false);await expect(page.getByText('Loading configuration notes…')).toHaveCount(0);
 await expect(page.getByRole('switch',{name:'Starts with zip tie touching wall'})).toBeDisabled();expect(records.size).toBe(0);
});
