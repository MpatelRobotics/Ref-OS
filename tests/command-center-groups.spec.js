
import {test,expect} from '@playwright/test';
async function mount(page){
 await page.route('**/command-groups-test',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">import '/src/index.css';import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,View=(await import('/src/components/CommandCenter.jsx')).default;window.calls=[];function App(){const[group,setGroup]=React.useState(''),[child,setChild]=React.useState('');const run=key=>()=>{window.calls.push(key);setChild(key);};return child?React.createElement('button',{onClick:()=>setChild('')},'Close child'):React.createElement(View,{group,onGroupChange:setGroup,matches:{},viols:[],fieldLog:[],presence:[],roster:[],onRoleCodes:run('codes'),onResetVolunteerSignIns:()=>window.calls.push('reset'),onVexSync:run('vex'),onTMSync:run('tm'),onSyncStatus:run('venue'),onOfflineTest:run('offline'),onPreEventTest:run('pre'),onTwoDeviceSyncTest:run('two'),onExportViolations:run('violations'),onExportNominations:run('nominations'),onExportEventReport:run('report'),onBackupAll:run('backup'),onDiagnosticReport:run('diagnostics'),extraTools:React.createElement('p',null,'Archive tools'),readinessTools:React.createElement('p',null,'Offline event tools')});}DOM.createRoot(document.getElementById('root')).render(React.createElement(App));</script>`}));
 await page.goto('/command-groups-test');
}
for(const [group,actions] of [
 ['Volunteer Access',[['Manage access codes','codes']]],
 ['Event Data & Sync',[['Sync everything','vex'],['Tournament Manager connection & imports','tm'],['Sync & Venue Server','venue']]],
 ['Event Readiness',[['Run offline readiness test','offline'],['Run pre-event system test','pre'],['Run two-device sync test','two']]],
 ['Backups & Reports',[['Export Violations','violations'],['Export Nominations','nominations'],['Export Event Report','report'],['Backup All JSON','backup'],['Admin Diagnostics','diagnostics']]],
]){
 test(group+' keeps all actions and returns to its group',async({page})=>{
  await page.setViewportSize({width:390,height:844});await mount(page);
  await page.getByRole('button',{name:new RegExp('^'+group.replace('&','&'))}).click();
  await expect(page.getByRole('heading',{name:group,exact:true})).toBeVisible();
  for(const [label,key] of actions){
   await page.getByRole('button',{name:new RegExp('^'+label)}).click();
   expect(await page.evaluate(()=>window.calls.at(-1))).toBe(key);
   await page.getByRole('button',{name:'Close child',exact:true}).click();
   await expect(page.getByRole('heading',{name:group,exact:true})).toBeVisible();
  }
  if(group==='Backups & Reports')await expect(page.getByText('Archive tools',{exact:true})).toBeVisible();
  if(group==='Event Readiness')await expect(page.getByText('Offline event tools',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Event Command Center',exact:true})).toBeVisible();
 });
}
test('volunteer reset still requires explicit confirmation',async({page})=>{
 await mount(page);await page.getByRole('button',{name:/^Volunteer Access /}).click();
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Reset Volunteer Sign Ins',exact:true}).click();
 expect(await page.evaluate(()=>window.calls)).toEqual([]);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Reset Volunteer Sign Ins',exact:true}).click();
 expect(await page.evaluate(()=>window.calls)).toEqual(['reset']);
});
