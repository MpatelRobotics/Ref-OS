import test from 'node:test';
import assert from 'node:assert/strict';
import { recordsThroughSession } from '../src/league/nominationCarryover.js';
test('violations retain IDs, severity, photos and original session through league finals', () => {
 const sessions=[{id:'s2',order:2},{id:'s1',order:1},{id:'finals',order:3}];
 const rows=[{id:'v1',sessionId:'s1',type:'major',photoKeys:['photo']},{id:'v2',sessionId:'s2',type:'minor'},{id:'v3',sessionId:'finals'}];
 assert.deepEqual(recordsThroughSession(rows,sessions,'s1'),[rows[0]]);
 assert.deepEqual(recordsThroughSession(rows,sessions,'s2'),rows.slice(0,2));
 assert.deepEqual(recordsThroughSession(rows,sessions,'finals'),rows);
 assert.equal(recordsThroughSession(rows,sessions,'s2')[0],rows[0]);
 // Clearing this session leaves earlier violations visible.
 assert.deepEqual(recordsThroughSession(rows.filter(r=>r.sessionId!=='s2'),sessions,'s2'),[rows[0]]);
});
test('converted tournament violations carry forward without duplication', () => {
 const row={id:'legacy',sessionId:null};
 assert.deepEqual(recordsThroughSession([row],[{id:'s1',order:1},{id:'s2',order:2}],'s2','s1'),[row]);
 assert.deepEqual(recordsThroughSession([row],[],null),[row]);
});
