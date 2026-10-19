import test from 'node:test';
import assert from 'node:assert/strict';
import { nominationsThroughSession } from '../src/league/nominationCarryover.js';
const sessions = [{id:'final',order:3},{id:'first',order:1},{id:'second',order:2}];
const noms = [{id:'a',sessionId:'first'},{id:'b',sessionId:'second'},{id:'c',sessionId:'final'},{id:'legacy',sessionId:null}];
test('later sessions include earlier nominations exactly once, including finals', () => {
  assert.deepEqual(nominationsThroughSession(noms,sessions,'second','first').map(n=>n.id),['a','b','legacy']);
  assert.deepEqual(nominationsThroughSession(noms,sessions,'final','first'),noms);
});
test('earlier sessions exclude future nominations and unassigned rows', () => {
  assert.deepEqual(nominationsThroughSession(noms,sessions,'first').map(n=>n.id),['a']);
});
test('tournaments keep all nominations and original attribution', () => {
  assert.equal(nominationsThroughSession(noms,[],null),noms);
  assert.equal(nominationsThroughSession(noms,sessions,'second')[0],noms[0]);
});
test('unknown selected session does not reveal other sessions', () => {
  assert.deepEqual(nominationsThroughSession(noms,sessions,'missing'),[]);
});
