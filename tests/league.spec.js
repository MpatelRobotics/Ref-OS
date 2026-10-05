import { test, expect } from '@playwright/test';

// Controlled backend tests: never create or modify production events.
const preamble = `import '/@vite/client'; import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;`;
async function harness(page, script) {
  await page.route('**/league-test', r => r.fulfill({contentType:'text/html',body:`<html><body><div id="root"></div><script type="module">${preamble}${script}</script></body></html>`}));
  await page.goto('/league-test');
  await page.waitForFunction(() => window.ready === true);
}

test('league session lifecycle, working session and volunteer controls', async ({page}) => {
  await page.route(/\/src\/api(?:\.js)?(?:\?.*)?$/, r => r.fulfill({contentType:'application/javascript',body:`
    window.leagueFixture = window.leagueFixture || {sessions:[]};
    export const listLeagueAttendance=async()=>[];
    export async function createLeagueSession(eventId,form){const sessions=window.leagueFixture.sessions;const s={...form,id:'s'+(sessions.length+1),order:sessions.length,status:'upcoming'};sessions.push(s);return s;}
    export async function updateLeagueSession(id,form){Object.assign(window.leagueFixture.sessions.find(s=>s.id===id),form);}
    export async function setLeagueSessionStatus(id,status){const sessions=window.leagueFixture.sessions;if(status==='active')sessions.filter(s=>s.status==='active'&&s.id!==id).forEach(s=>s.status='completed');sessions.find(s=>s.id===id).status=status;}
    export async function reorderLeagueSessions(eventId,ids){ids.forEach((id,i)=>window.leagueFixture.sessions.find(s=>s.id===id).order=i);}
    export async function deleteLeagueSession(id,typed){const sessions=window.leagueFixture.sessions;const s=sessions.find(s=>s.id===id);if(typed!==s.name)return {status:'confirm_required',counts:{matches:1}};window.leagueFixture.sessions=sessions.filter(s=>s.id!==id);return {status:'deleted'};}
  `}));
  page.on('dialog', d => d.accept());
  await harness(page, `
    const React=(await import('/node_modules/.vite/deps/react.js')).default;
    const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const Overview=(await import('/src/league/LeagueOverview.jsx')).default;
    const api=await import('/src/api');
    function App(){const [sessions,setSessions]=React.useState([]);const [working,setWorking]=React.useState('');const [admin,setAdmin]=React.useState(true);window.volunteer=()=>{setAdmin(false);setWorking('');};return React.createElement(Overview,{eventId:'test-league',eventName:'Test League',sessions,workingSessionId:working,isAdmin:admin,mode:'page',onOpenSession:setWorking,onReload:async()=>setSessions(window.leagueFixture.sessions.map(s=>({...s})))});}
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));window.ready=true;
  `);
  await page.getByLabel('Name',{exact:true}).fill('Opening Day');
  await page.getByLabel('Date',{exact:true}).fill('2026-10-05');
  await page.getByRole('button',{name:'Create Session',exact:true}).click();
  const opening=page.getByRole('listitem').filter({hasText:'Opening Day'});
  await expect(opening.getByRole('button',{name:'Complete Session'})).toBeVisible();
  await page.getByRole('button',{name:'Create Session',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill('Finals Day');
  await page.getByRole('combobox').selectOption('finals');
  await page.getByRole('button',{name:'Create Session',exact:true}).click();
  const finals=page.getByRole('listitem').filter({hasText:'Finals Day'});
  await expect(finals).toContainText('League Finals');
  await finals.getByRole('button',{name:'Start Session',exact:true}).click();
  await expect(opening.getByRole('button',{name:'Mark Upcoming'})).toBeVisible();
  await expect(finals.getByRole('button',{name:'Complete Session'})).toBeVisible();
  await opening.getByRole('button',{name:'Work in Opening Day'}).click();
  await expect(opening).toContainText('This device');
  await finals.getByRole('button',{name:'Complete Session'}).click();
  await expect(page.getByText('No session is Active. Start a session so volunteers know where their records belong.')).toBeVisible();
  await finals.getByRole('button',{name:'Start Session'}).click();
  await opening.getByRole('button',{name:'Delete',exact:true}).click();
  const confirmation=page.getByRole('dialog');
  await expect(confirmation).toContainText('1 matches');
  await expect(confirmation.getByRole('button',{name:'Delete Session'})).toBeDisabled();
  await confirmation.getByRole('textbox').fill('Opening Day');
  await confirmation.getByRole('button',{name:'Delete Session'}).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await page.evaluate(()=>window.volunteer());
  await expect(page.getByRole('button',{name:'Start Session'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Edit',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Create Session',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Work in Finals Day'})).toBeVisible();
});

test('actual API keeps repeated match numbers, ranking snapshots and offline caches in their sessions', async ({page}) => {
  // Use the actual API implementation, bypassing its generic E2E shortcut.
  await page.route(/\/src\/api(?:\.js)?(?:\?.*)?$/, async r => {
    const response=await r.fetch();
    const source=(await response.text()).replace(/const E2E_MOCK = [^;]+;/,'const E2E_MOCK = false;');
    await r.fulfill({response,body:source});
  });
  await page.route(/\/src\/supabaseClient(?:\.js)?(?:\?.*)?$/, r=>r.fulfill({contentType:'application/javascript',body:`
    window.rows=[];window.writes=[];window.failReads=false;
    export const supabase={from(table){let filters={};let row=null;let writing=false;const q={select(){return q;},eq(k,v){filters[k]=v;return q;},order(){return q;},single(){return q;},upsert(value,options){writing=true;row=value;window.writes.push({table,row,options});return q;},then(resolve,reject){let result;if(writing){const key=r=>r.event_id+'|'+(r.session_id||'')+'|'+(r.key||r.phase+'|'+r.num);const i=window.rows.findIndex(x=>x.table===table&&key(x.row)===key(row));if(i>=0)window.rows[i]={table,row};else window.rows.push({table,row});result={data:row,error:null};}else if(window.failReads){result={data:null,error:{message:'network unavailable'}};}else{result={data:window.rows.filter(x=>x.table===table&&Object.entries(filters).every(([k,v])=>x.row[k]===v)).map(x=>x.row),error:null};}return Promise.resolve(result).then(resolve,reject);}};return q;}};
  `}));
  await harness(page, `window.api=await import('/src/api');window.ready=true;`);
  const result=await page.evaluate(async()=>{
    const api=window.api;
    api.setLeagueContext('league','one');
    await api.addMatch('league',{num:1,red:['111A'],blue:['222B'],redScore:10});
    await api.upsertEventSetting('league','rank_snapshot',[{team:'111A',rank:1}]);
    const one=await api.listMatches('league');
    api.setLeagueContext('league','two');
    await api.addMatch('league',{num:1,red:['333C'],blue:['444D'],redScore:20});
    await api.upsertEventSetting('league','rank_snapshot',[{team:'333C',rank:1}]);
    await api.upsertEventSetting('league','competition_program','v5');
    const two=await api.listMatches('league');
    window.failReads=true;
    api.setLeagueContext('league','one');const offlineOne=await api.listMatches('league');
    api.setLeagueContext('league','two');const offlineTwo=await api.listMatches('league');
    api.setLeagueContext('league','');
    return {one,two,offlineOne,offlineTwo,writes:window.writes,otherEvent:api.leagueSessionFor('other'),cleared:api.leagueSessionFor('league')};
  });
  expect(result.one[0].red).toEqual(['111A']);expect(result.two[0].red).toEqual(['333C']);
  expect(result.one[0].redScore).toBe(10);expect(result.two[0].redScore).toBe(20);
  expect(result.offlineOne).toEqual(result.one);expect(result.offlineTwo).toEqual(result.two);
  expect(result.writes.filter(x=>x.table==='matches').map(x=>x.row.session_id)).toEqual(['one','two']);
  expect(result.writes.filter(x=>x.table==='matches').every(x=>x.options.onConflict.includes('session_key'))).toBe(true);
  expect(result.writes.filter(x=>x.table==='event_settings').map(x=>x.row.key)).toEqual(['rank_snapshot@one','rank_snapshot@two','competition_program']);
  expect(result.otherEvent).toBeNull();expect(result.cleared).toBeNull();
});

test('offline violation and inspection photo retain their original league session during retry',async({page})=>{
  await page.route(/\/src\/api(?:\.js)?(?:\?.*)?$/,r=>r.fulfill({contentType:'application/javascript',body:`
    window.synced=[];window.offline=true;
    export const queuedRecordSession=async()=>{throw new Error('Existing session must not be reassigned');};
    export async function addViolationRow(eventId,row){if(window.offline)throw new TypeError('Failed to fetch');window.synced.push({kind:'violation',session:row.session_id});return row;}
    export async function addTeamPhoto(eventId,number,dataUrl,angle,id,generation,session){window.synced.push({kind:'photo',session});return ['saved'];}
  `}));
  await harness(page,`window.queue=await import('/src/outbox');window.ready=true;`);
  const result=await page.evaluate(async()=>{
    const q=window.queue;
    await q.enqueue('league',{id:'v1',kind:'violation',eventId:'league',row:{session_id:'opening',team:'111A'}});
    await q.enqueue('league',{id:'p1',kind:'robot_photo',eventId:'league',sessionId:'opening',number:'111A',angle:'front',dataUrl:'data:image/jpeg;base64,AA=='});
    await q.flush('league');const pending=(await q.loadQueue('league')).length;
    window.offline=false;await q.flush('league');
    return {pending,remaining:(await q.loadQueue('league')).length,failed:(await q.loadFailed('league')).length,synced:window.synced};
  });
  expect(result.pending).toBe(2);expect(result.remaining).toBe(0);expect(result.failed).toBe(0);
  expect(result.synced).toEqual([{kind:'violation',session:'opening'},{kind:'photo',session:'opening'}]);
});


