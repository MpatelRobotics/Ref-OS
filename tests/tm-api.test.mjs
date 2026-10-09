import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createTokenProvider } from '../supabase/functions/tm-api-token/token.js';
import { signedHeaders, tmAddress, createResourceReader } from '../tm-bridge/protocol.mjs';
import { createConnector } from '../tm-bridge/connector.mjs';
import { normalizeTmSnapshot } from '../src/tmSnapshot.js';
import { applyTmSnapshot } from '../src/tmApplySnapshot.js';

const match = (state = 'SCORED', scores = [133, 0], session = 0) => ({ matchInfo: { state, matchTuple: { session, division: 1, round: 'QUAL', instance: 1, match: 1 }, alliances: [{ teams: [{ number: '32092X' }, { number: '32092G' }] }, { teams: [{ number: '13713A' }, { number: '32092H' }] }] }, finalScore: scores, winningAlliance: 0 });
const fixture = () => ({ event: { name: 'ButterNova', code: 'VE-V5-26-65633' }, teams: [{ number: '32092X', name: 'Team X' }], matches: [match()], rankings: [{ rank: 1, alliance: { teams: [{ number: '32092X' }] }, wins: 1, losses: 0, ties: 0, wp: 2, ap: 0, sp: 133 }], skills: [{ rank: 1, number: '1082C', totalScore: 10, progHighScore: 10, progAttempts: 1, driverHighScore: 0, driverAttempts: 0 }] });
const json = (value, options = {}) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json', ...options.headers }, status: options.status || 200 });

test('TM accepts plain IP addresses and hostnames while preserving ports and rejecting unsafe URLs', () => {
  assert.equal(tmAddress('192.168.0.164').origin, 'http://192.168.0.164');
  assert.equal(tmAddress(' 192.168.0.164:8080 ').origin, 'http://192.168.0.164:8080');
  assert.equal(tmAddress('tm-server:8080').origin, 'http://tm-server:8080');
  assert.equal(tmAddress('https://tm-server:8443/').origin, 'https://tm-server:8443');
  for (const value of ['', 'ftp://tm-server', 'http://user:key@tm-server', 'tm-server/api/event', 'tm-server?key=secret', 'tm-server#fragment']) assert.throws(() => tmAddress(value));
});

test('OAuth uses form credentials, coalesces requests, caches and renews before expiry', async () => {
  let calls = 0, now = 1000;
  const token = createTokenProvider({ clientId: 'approved-id', clientSecret: 'private-secret', now: () => now, fetcher: async (url, options) => {
    assert.equal(url, 'https://auth.vextm.dwabtech.com/oauth2/token');
    assert.equal(options.body.get('grant_type'), 'client_credentials');
    assert.equal(options.body.get('client_secret'), 'private-secret');
    calls++; return json({ access_token: `token-${calls}`, token_type: 'Bearer', expires_in: 300 });
  } });
  const values = await Promise.all([token(), token(), token()]);
  assert.equal(calls, 1); assert.equal(values[0].accessToken, 'token-1');
  now += 200000; await token(); assert.equal(calls, 1);
  now += 80000; assert.equal((await token()).accessToken, 'token-2');
});
test('OAuth errors never expose upstream secret text and can be retried', async () => {
  let fail = true;
  const token = createTokenProvider({ clientId: 'id', clientSecret: 'secret', fetcher: async () => fail ? new Response('private-secret', { status: 401 }) : json({ access_token: 'ok', token_type: 'bearer', expires_in: 300 }) });
  await assert.rejects(token(), e => !e.message.includes('private-secret'));
  fail = false; assert.equal((await token()).accessToken, 'ok');
});
test('signed request follows the guide including port, query and final newline', () => {
  const date = 'Thu, 08 Oct 2026 00:00:00 GMT';
  const expected = 'GET\n/api/matches/1?test=1\ntoken:bearer\nhost:10.0.0.5:8080\nx-tm-date:Thu, 08 Oct 2026 00:00:00 GMT\n';
  const headers = signedHeaders(tmAddress('http://10.0.0.5:8080'), '/api/matches/1?test=1', 'event-key', 'bearer', date);
  assert.equal(headers['x-tm-signature'], createHmac('sha256', 'event-key').update(expected).digest('hex'));
  assert.equal(headers.Authorization, 'Bearer bearer');
  assert.throws(() => tmAddress('http://user:pass@tm/path'));
});
test('resource reader checks no faster than a minute and reuses data after 304', async () => {
  let calls = 0, now = 0;
  const read = createResourceReader({ now: () => now, fetcher: async (url, options) => {
    calls++; if (calls > 1) { assert.equal(options.headers['If-Modified-Since'], 'Thu, 08 Oct 2026 00:00:00 GMT'); return new Response(null, { status: 304 }); }
    return json({ matches: [match()] }, { headers: { 'Last-Modified': 'Thu, 08 Oct 2026 00:00:00 GMT' } });
  } });
  const url = tmAddress('http://tm:8080');
  const [a,b] = await Promise.all([read(url, '/api/matches/1', 'key', 'token'), read(url, '/api/matches/1', 'key', 'token')]);
  assert.deepEqual(a,b); assert.equal(calls,1);
  now = 59999; await read(url, '/api/matches/1', 'key', 'token'); assert.equal(calls,1);
  now = 60000; assert.deepEqual(await read(url, '/api/matches/1', 'key', 'token'), a); assert.equal(calls,2);
});
test('invalid responses do not poison conditional caching', async () => {
  let calls = 0;
  const read = createResourceReader({ fetcher: async () => ++calls === 1 ? new Response('bad json', { headers: { 'Last-Modified': 'invalid' } }) : json({ matches: [] }) });
  const url = tmAddress('http://tm');
  await assert.rejects(read(url, '/api/matches/1', 'key', 'token'));
  assert.deepEqual(await read(url, '/api/matches/1', 'key', 'token'), { matches: [] });
});
test('normalizer preserves official ranks and accepts scored zero values', () => {
  const data = fixture(); data.matches.push({ ...match('SCORED', [0,0]), matchInfo: { ...match().matchInfo, matchTuple: { ...match().matchInfo.matchTuple, match: 2 } } });
  const result = normalizeTmSnapshot(data);
  assert.equal(result.scores.length,2); assert.equal(result.scores[0].blueScore,0);
  assert.equal(result.skills[0].rank,1); assert.equal(result.skills[0].programming,10);
  assert.equal(result.rankings[0].wp,2);
  assert.equal(normalizeTmSnapshot({ ...fixture(), matches: [match('QUEUED', [133,0])] }).scores.length,0);
});
test('sessions and repeated elimination identities cannot be silently merged', () => {
  const data = fixture(); data.matches.push(match('SCORED', [4,5],1));
  assert.equal(normalizeTmSnapshot(data).matches.length,0);
  assert.equal(normalizeTmSnapshot(data,0).scores[0].redScore,133);
  data.matches = [match(), match()]; assert.equal(normalizeTmSnapshot(data).matches.length,0);
  data.skills.push(data.skills[0]); assert.throws(() => normalizeTmSnapshot(data), /duplicate skills/);
});

function mockApi() {
  const calls = [], teams = [], matches = [], settings = {};
  return { calls, teams, matches, settings,
    listTeams: async () => teams,
    bulkUpsertTeams: async (event, rows) => { calls.push(['teams',event]); for (const row of rows) { const found = teams.find(t => t.number === row.number); if (found) Object.assign(found,row); else teams.push({...row}); } },
    listMatches: async () => matches,
    insertTmMatch: async (event,row) => { calls.push(['insert',event]); matches.push({...row}); return true; },
    updateExistingVexScore: async (event,row) => { calls.push(['scores',event]); Object.assign(matches.find(m => m.num === row.num),{ redScore: row.redScore, blueScore: row.blueScore }); return 1; },
    bulkUpsertRankings: async (event,rows) => { calls.push(['rankings',event]); for (const row of rows) Object.assign(teams.find(t => t.number === row.number),{ rank: row.rank }); },
    upsertEventSetting: async (event,key,value) => { calls.push([key,event]); settings[key] = value; },
  };
}
test('whole snapshot imports through event API, adds opt-in schedule and avoids unchanged writes', async () => {
  const api = mockApi(), hashes = {}, snapshot = normalizeTmSnapshot(fixture());
  const options = { api, eventId: 'selected-league-event', includeSchedule: true, hashes, current: () => true, by: 'Admin' };
  const result = await applyTmSnapshot(snapshot, options);
  assert.match(result,/1 matches added · 1 scores updated/);
  assert.equal(api.matches[0].redScore,133); assert.equal(api.settings.skills_rankings.rows[0].programming,10);
  assert.ok(api.calls.every(c => c[1] === 'selected-league-event'));
  const count = api.calls.length; await applyTmSnapshot(snapshot,options); assert.equal(api.calls.length,count);
});
test('scores-only preserves different team assignments and fields; empty lists retain data', async () => {
  const api = mockApi(); api.matches.push({phase:'qual',num:1,red:['OTHER','32092G'],blue:['13713A','32092H'],field:'Field 1',redScore:9,blueScore:8});
  const options = { api,eventId:'event',includeSchedule:false,hashes:{},current:()=>true };
  const result = await applyTmSnapshot(normalizeTmSnapshot(fixture()),options);
  assert.match(result,/1 unmatched scores skipped/); assert.equal(api.matches[0].redScore,9); assert.equal(api.matches[0].field,'Field 1');
  assert.ok(!api.calls.some(c=>c[0]==='insert'));
  const empty = {...fixture(),teams:[],matches:[],rankings:[],skills:[]};
  const count=api.calls.length; await applyTmSnapshot(normalizeTmSnapshot(empty),options); assert.equal(api.calls.length,count);
});
test('leaving an event while reading cancels subsequent writes; failures remain retryable', async () => {
  const api=mockApi(); let current=true;
  api.listTeams=async()=>{current=false;return[];};
  await applyTmSnapshot(normalizeTmSnapshot(fixture()),{api,eventId:'old',includeSchedule:true,hashes:{},current:()=>current});
  assert.equal(api.calls.length,0);
  const retry=mockApi(),hashes={}; retry.bulkUpsertTeams=async()=>{throw Error('offline');};
  await assert.rejects(applyTmSnapshot(normalizeTmSnapshot(fixture()),{api:retry,eventId:'event',hashes,current:()=>true}));
  assert.deepEqual(hashes,{});
});
test('real connector HTTP flow authorizes admin and reads documented resources; origin and pairing are enforced', async t => {
  const resources=fixture(),paths=[]; let cloudCalls=0, denied=false;
  const server=createConnector({origin:'https://refos.test',pairingCode:'paired',cloudUrl:'https://cloud.test',fetcher:async(url,options)=>{
    if(String(url).startsWith('https://cloud.test')) {cloudCalls++;assert.equal(options.headers.Authorization,'Bearer user-session');assert.equal(JSON.parse(options.body).eventId,'event-id');return denied?json({error:'Event administrator access is required.'},{status:403}):json({accessToken:'approved-bearer'});}
    const path=new URL(url).pathname;paths.push(path);assert.equal(options.headers.Authorization,'Bearer approved-bearer');
    const data={'/api/event':{event:resources.event},'/api/divisions':{divisions:[{id:1,name:'Division 1'}]},'/api/teams/1':{teams:resources.teams},'/api/matches/1':{matches:resources.matches},'/api/rankings/1/QUAL':{rankings:resources.rankings},'/api/skills':{skillsRankings:resources.skills}};
    return json(data[path]);
  }});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const url=`http://127.0.0.1:${server.address().port}/snapshot`;
  const body={address:'http://tm.test:8080',apiKey:'event-key',authorization:'Bearer user-session',anonKey:'public-key',eventId:'event-id',division:1};
  const send=(origin='https://refos.test',pairing='paired')=>fetch(url,{method:'POST',headers:{Origin:origin,'x-refos-pairing':pairing,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await send('https://other.test')).status,403);assert.equal((await send(undefined,'wrong')).status,403);assert.equal(cloudCalls,0);
  const response=await send();assert.equal(response.status,200);assert.equal(normalizeTmSnapshot(await response.json()).scores[0].redScore,133);
  assert.deepEqual(paths.sort(),['/api/event','/api/divisions','/api/teams/1','/api/matches/1','/api/rankings/1/QUAL','/api/skills'].sort());
  denied=true;assert.equal((await send()).status,502);assert.equal(paths.length,6);
});

test('forced refresh fetches fresh data without conditional-cache headers', async () => {
  let calls = 0;
  const read = createResourceReader({ now: () => 1000, fetcher: async (_url, options) => {
    calls++;
    assert.equal(options.headers['If-Modified-Since'], undefined);
    return json({rankings:[{rank:calls}]},{headers:{'last-modified':'Thu, 08 Oct 2026 00:00:00 GMT'}});
  }});
  const url = tmAddress('http://localhost:8080');
  await read(url, '/api/rankings/1/QUAL', 'key', 'token');
  const refreshed = await read(url, '/api/rankings/1/QUAL', 'key', 'token', true);
  assert.equal(calls, 2);
  assert.equal(refreshed.rankings[0].rank, 2);
});


test('TM elimination pairings with repeated game numbers import and sync distinct scores', async () => {
  const data = fixture();
  data.matches = Array.from({length: 8}, (_, i) => {
    const row = match('SCORED', [i + 10, i]);
    row.matchInfo.matchTuple = {session: 0, division: 1, round: 'R16', instance: i + 1, match: 1};
    return row;
  });
  for (const [round, instance, game] of [['QF', 3, 1], ['SF', 2, 1], ['FINAL', 1, 2]]) {
    const row = match('SCORED', [44, 22]);
    row.matchInfo.matchTuple = {session: 0, division: 1, round, instance, match: game};
    data.matches.push(row);
  }
  const snapshot = normalizeTmSnapshot(data);
  assert.equal(snapshot.matches.length, 11);
  assert.deepEqual(snapshot.matches.slice(0, 8).map(row => row.num), [1,2,3,4,5,6,7,8]);
  assert.equal(snapshot.matches[8].num, 3);
  assert.equal(snapshot.matches[9].num, 2);
  assert.equal(snapshot.matches[10].num, 2);
  assert.deepEqual(snapshot.warnings, []);
  const api = mockApi();
  api.updateExistingVexScore = async (_event, row) => {
    Object.assign(api.matches.find(m => m.phase === row.phase && m.num === row.num), {redScore: row.redScore, blueScore: row.blueScore});
    return 1;
  };
  const result = await applyTmSnapshot(snapshot, {api, eventId: 'event', includeSchedule: true, hashes: {}, current: () => true});
  assert.match(result, /11 matches added · 11 scores updated/);
  assert.equal(api.matches.find(m => m.phase === 'r16' && m.num === 8).redScore, 17);
});

test('tied elimination game and replay remain distinct and both scores sync', () => {
  const data = fixture();
  data.matches = [1,2].map(game => {
    const row = match('SCORED', game === 1 ? [0,0] : [10,20]);
    row.matchInfo.matchTuple = {session:0,division:1,round:'QF',instance:2,match:game};
    return row;
  });
  const snapshot = normalizeTmSnapshot(data);
  assert.deepEqual(snapshot.matches.map(m=>m.num), [2,1002]);
  assert.deepEqual(snapshot.scores.map(m=>[m.redScore,m.blueScore]), [[0,0],[10,20]]);
  assert.deepEqual(snapshot.warnings, []);
});
