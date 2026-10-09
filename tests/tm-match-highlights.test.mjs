import test from 'node:test';
import assert from 'node:assert/strict';
import { tmMatchHighlights } from '../src/tmMatchHighlights.js';
const rows = { a: { id:'a',phase:'qual',num:3 }, b:{ id:'b',phase:'qual',num:4 }, c:{id:'c',phase:'qual',num:5} };
const activity = { updatedAt:1000,fieldSets:[{connected:true,fields:[{status:'playing',match:{round:'QUAL',match:3}}]}] };
test('current match and next unscored match are highlighted; stale or stopped activity is ignored', () => {
  assert.deepEqual(tmMatchHighlights(rows, activity, 1001), {a:'current',b:'upcoming'});
  assert.deepEqual(tmMatchHighlights(rows, activity, 92000), {});
  assert.deepEqual(tmMatchHighlights(rows, {...activity,fieldSets:[{connected:true,fields:[{status:'stopped',match:{round:'QUAL',match:3}}]}]},1001), {});
  assert.deepEqual(tmMatchHighlights({...rows,b:{...rows.b,redScore:0,blueScore:0}},activity,1001), {a:'current',c:'upcoming'});
});
test('multiple running fields stay current; ambiguous identities are not guessed', () => {
  const multi = {...activity,fieldSets:[{connected:true,fields:[...activity.fieldSets[0].fields,{status:'playing',match:{round:'QUAL',match:4}}]}]};
  assert.deepEqual(tmMatchHighlights(rows,multi,1001), {a:'current',b:'current',c:'upcoming'});
  assert.deepEqual(tmMatchHighlights({...rows,duplicate:{id:'duplicate',phase:'qual',num:3}},activity,1001), {});
});


test('live elimination highlights use pairing instance rather than game number', () => {
  for (const round of ['R16', 'QF', 'SF', 'QTR', 'SEMI']) {
    const phase = {R16:'r16',QF:'qf',SF:'sf',QTR:'qf',SEMI:'sf'}[round];
    const matches = {a:{id:'a',phase,num:1},b:{id:'b',phase,num:2},c:{id:'c',phase,num:3}};
    const live = {updatedAt:1000,fieldSets:[{connected:true,fields:[{status:'playing',match:{round,instance:2,match:1}}]}]};
    assert.deepEqual(tmMatchHighlights(matches,live,1001), {b:'current',c:'upcoming'});
    live.fieldSets[0].fields[0].match.match = 2;
    assert.deepEqual(tmMatchHighlights(matches,live,1001), {});
  }
});
