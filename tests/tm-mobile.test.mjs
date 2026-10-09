import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createMobileTmClient, mobileSignedHeaders } from '../src/tmMobileClient.js';

test('mobile signatures match the TM protocol, including port and trailing newline', async () => {
  const url = new URL('http://192.168.1.20:8080'), date = 'Thu, 08 Oct 2026 18:00:00 GMT';
  const headers = await mobileSignedHeaders(url, '/api/matches/1', 'event-key', 'token', date);
  const text = `GET\n/api/matches/1\ntoken:token\nhost:192.168.1.20:8080\nx-tm-date:${date}\n`;
  assert.equal(headers['x-tm-signature'], createHmac('sha256', 'event-key').update(text).digest('hex'));
  assert.equal(headers.Authorization, 'Bearer token');
  assert.equal('Host' in headers, false); // Native HTTP/WebSocket sets Host from the actual URL.
  const native = await mobileSignedHeaders(url, '/api/matches/1', 'event-key', 'token', date, async ({ key, message }) => ({ signature: createHmac('sha256', key).update(message).digest('hex') }));
  assert.deepEqual(native, headers);
});

function harness() {
  let time = Date.now(), listener, opens = [], closed = 0, requests = [];
  const resources = {
    '/api/event': { event: { name: 'Test event', code: 'RE-V5RC-26-1234' } },
    '/api/divisions': { divisions: [{ id: 1, name: 'Main' }] },
    '/api/teams/1': { teams: [{ number: '1A' }] },
    '/api/matches/1': { matches: [{ finalScore: [42, 0] }] },
    '/api/rankings/1/QUAL': { rankings: [{ rank: 1, wins: 3 }] },
    '/api/skills': { skillsRankings: [{ number: '1A', totalScore: 100 }] },
    '/api/fieldsets': { fieldSets: [{ id: 1, name: 'Set' }] },
    '/api/fieldsets/1/fields': { fields: [{ id: 4, name: 'Red' }] },
  };
  const sockets = {
    async closeAll() { closed++; },
    async addListener(name, callback) { assert.equal(name, 'socketEvent'); listener = callback; return { async remove() { listener = undefined; } }; },
    async open(options) { opens.push(options); listener({ id: options.id, type: 'open' }); },
    async sign({key,message}) { return { signature: createHmac('sha256', key).update(message).digest('hex') }; },
  };
  const http = async options => {
    requests.push(options); assert.equal(options.disableRedirects, true);
    const url = new URL(options.url);
    if (url.hostname === 'cloud.example') {
      assert.deepEqual(options.data, { eventId: 'event-id' });
      assert.equal(options.headers.Authorization, 'Bearer user-session');
      assert.equal(JSON.stringify(options).includes('event-key'), false);
      return { status: 200, data: { accessToken: 'oauth-token' } };
    }
    assert.equal(url.hostname, '192.168.1.20');
    const expected = createHmac('sha256', 'event-key').update(`GET\n${url.pathname}\ntoken:oauth-token\nhost:${url.host}\nx-tm-date:${options.headers['x-tm-date']}\n`).digest('hex');
    assert.equal(options.headers['x-tm-signature'], expected);
    assert.equal(options.headers.Authorization, 'Bearer oauth-token');
    assert.equal(JSON.stringify(options).includes('user-session'), false);
    return { status: 200, data: resources[url.pathname] };
  };
  const client = createMobileTmClient({ http, sockets, cloudUrl: 'https://cloud.example', now: () => time });
  return { client, http, sockets, resources, requests, opens, emit: data => listener(data), advance: ms => time += ms, closed: () => closed, hasListener: () => Boolean(listener) };
}
const settings = { address: '192.168.1.20:8080', apiKey: 'event-key', authorization: 'Bearer user-session', anonKey: 'public-anon', eventId: 'event-id', division: 1, liveFields: true };

test('mobile snapshot reads fresh rankings and scores, streams fields, reuses sockets and clears on disconnect', async () => {
  const h = harness();
  try {
    const result = await h.client.request('snapshot', settings);
    assert.deepEqual(result.matches[0].finalScore, [42, 0]);
    assert.equal(result.rankings[0].wins, 3); assert.equal(result.skills[0].totalScore, 100);
    const socket = h.opens[0]; assert.equal(socket.url, 'ws://192.168.1.20:8080/api/fieldsets/1');
    const send = data => h.emit({ id: socket.id, type: 'message', data: JSON.stringify(data) });
    send({ type: 'fieldMatchAssigned', fieldID: 4, match: { division: 1, session: 0, round: 'QUAL', match: 3, instance: 1 } });
    send({ type: 'matchStarted', fieldID: 4 });
    let activity = await h.client.request('activity', { connectionId: result.connectionId });
    assert.equal(activity.fieldSets[0].connected, true);
    assert.equal(activity.fieldSets[0].fields[0].status, 'playing');
    assert.equal(activity.fieldSets[0].fields[0].match.match, 3);
    send({ type: 'matchStopped', fieldID: 4 });
    h.advance(60000); h.resources['/api/rankings/1/QUAL'].rankings[0].wins = 4;
    const next = await h.client.request('snapshot', settings);
    assert.equal(next.rankings[0].wins, 4); assert.equal(next.connectionId, result.connectionId); assert.equal(h.opens.length, 1);
    assert.equal(h.requests.filter(r => r.url.endsWith('/api/rankings/1/QUAL')).length, 2);
    activity = await h.client.request('activity', { connectionId: next.connectionId });
    assert.equal(activity.fieldSets[0].fields[0].status, 'stopped');
    await h.client.request('disconnect', { connectionId: next.connectionId });
    assert.equal(h.hasListener(), false);
    await assert.rejects(h.client.request('activity', { connectionId: next.connectionId }), /expired/);
  } finally { await h.client.close(); }
});

test('lease expires safely and invalid divisions never open live sockets', async () => {
  const h = harness();
  try {
    await assert.rejects(h.client.request('snapshot', { ...settings, division: 2 }), /division no longer exists/);
    assert.equal(h.opens.length, 0);
    const result = await h.client.request('snapshot', settings);
    h.advance(90001);
    await assert.rejects(h.client.request('activity', { connectionId: result.connectionId }), /expired/);
    assert.equal(h.hasListener(), false);
  } finally { await h.client.close(); }
});

test('authentication rejection never sends a request or session token to TM', async () => {
  let calls = 0;
  const client = createMobileTmClient({ cloudUrl: 'https://cloud.example', sockets: { async closeAll() {} }, http: async () => { calls++; return { status: 403, data: { error: 'Event administrator access is required.' } }; } });
  await assert.rejects(client.request('snapshot', settings), /administrator/);
  assert.equal(calls, 1);
});

test('disconnect cancels an in-flight snapshot before it can open sockets', async () => {
  const h = harness(); let release;
  const client = createMobileTmClient({ cloudUrl: 'https://cloud.example', sockets: h.sockets, http: options => new Promise(resolve => { release = () => h.http(options).then(resolve); }) });
  const pending = client.request('snapshot', settings);
  await client.request('disconnect', { connectionId: '' }); release();
  await assert.rejects(pending, /cancelled/); assert.equal(h.opens.length, 0);
});

test('field connection retries after failure and clears old match identity', async () => {
  const h = harness();
  try {
    const result = await h.client.request('snapshot', settings);
    h.emit({ id: h.opens[0].id, type: 'message', data: JSON.stringify({ type: 'fieldMatchAssigned', fieldID: 4, match: { division: 1, session: 0, round: 'QUAL', match: 3, instance: 1 } }) });
    h.emit({ id: h.opens[0].id, type: 'error' });
    let activity = await h.client.request('activity', { connectionId: result.connectionId });
    assert.equal(activity.fieldSets[0].connected, false);
    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.equal(h.opens.length, 2);
    activity = await h.client.request('activity', { connectionId: result.connectionId });
    assert.equal(activity.fieldSets[0].fields[0].match, null); assert.equal(activity.fieldSets[0].fields[0].status, 'unknown');
  } finally { await h.client.close(); }
});
