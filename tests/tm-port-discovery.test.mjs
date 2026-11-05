import test from 'node:test';
import assert from 'node:assert/strict';
import { tmPortCandidates, createTmPortDiscovery } from '../src/tmPortDiscovery.js';
const header = { event: { name: 'Test event' }, divisions: [{ id: 1, name: 'Main' }] };
test('only bare IPs trigger bounded discovery; explicit addresses stay exact', () => {
  assert.equal(tmPortCandidates('192.168.1.50').length, 4);
  for (const input of ['192.168.1.50:80', '192.168.1.50:9000', 'https://192.168.1.50', 'http://192.168.1.50', 'tm.local']) assert.equal(tmPortCandidates(input).length, 1);
  assert.throws(() => tmPortCandidates('192.168.1.50/api'));
});
test('ignores unrelated services, finds TM and pins later sync to detected address', async () => {
  const discover = createTmPortDiscovery(), seen = [];
  const body = { eventId: 'event', address: '192.168.1.50', division: 1, liveFields: true };
  const request = async b => {
    seen.push(b);
    return b.address.endsWith(':8080') ? (b.division == null ? header : { matches: [] }) : { welcome: 'Not TM' };
  };
  const result = await discover(body, request);
  assert.equal(result.detectedAddress, 'http://192.168.1.50:8080');
  assert.equal(seen[0].liveFields, false);
  assert.equal(seen[0].division, null);
  assert.deepEqual(seen.map(b => b.address), ['http://192.168.1.50', 'http://192.168.1.50:8080', 'http://192.168.1.50:8080']);
  seen.length = 0;
  await discover(body, request);
  assert.equal(seen.length, 1);
  await assert.rejects(discover(body, async () => { throw Error('Disconnected'); }), /Disconnected/);
});
test('authentication errors stop discovery and are preserved', async () => {
  let calls = 0;
  await assert.rejects(createTmPortDiscovery()({ address: '192.168.1.50' }, async () => { calls++; throw Error('TM rejected the event key or request signature.'); }), /rejected/);
  assert.equal(calls, 1);
});
test('failure explains custom ports and never searches other hosts', async () => {
  const seen = [];
  await assert.rejects(createTmPortDiscovery()({ address: '192.168.1.50' }, async b => { seen.push(b.address); throw Error('Connection refused'); }), /IP:port/);
  assert.equal(seen.length, 4);
  assert.ok(seen.every(address => new URL(address).hostname === '192.168.1.50'));
});
