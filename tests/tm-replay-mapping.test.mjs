import test from 'node:test';
import assert from 'node:assert/strict';
import {matchTmDivision} from '../src/tmDivisionMapping.js';
import {eliminationPairingKey,eliminationResultLabel} from '../src/tmReplayGrouping.js';
test('unique division names map across different source IDs; ambiguous names and IDs are never guessed',()=>{
 const local=[{id:1,name:'Science'},{id:2,name:'Technology'}],remote=[{id:20,name:' SCIENCE '},{id:10,name:'Technology'}];
 assert.equal(matchTmDivision(remote,local,1).id,20);assert.equal(matchTmDivision(remote,local,2).id,10);
 assert.equal(matchTmDivision([{id:1,name:'Other'}],local,1),null);
 assert.equal(matchTmDivision([...remote,{id:30,name:'Science'}],local,1),null);
 assert.equal(matchTmDivision(remote,local,0),null);
 assert.equal(matchTmDivision(remote,local,1,{1:{id:10,name:'Technology'}}).id,10);
 assert.equal(matchTmDivision(remote,local,1,{1:{id:10,name:'Old name'}}).id,20);
});
test('replay games share a pairing while rounds and pairings remain distinct; finals share one series',()=>{
 assert.equal(eliminationPairingKey({phase:'qf',num:2}),eliminationPairingKey({phase:'qf',num:1002}));
 assert.notEqual(eliminationPairingKey({phase:'qf',num:2}),eliminationPairingKey({phase:'qf',num:1003}));
 assert.notEqual(eliminationPairingKey({phase:'qf',num:2}),eliminationPairingKey({phase:'sf',num:2}));
 assert.equal(eliminationPairingKey({phase:'final',num:1}),eliminationPairingKey({phase:'final',num:4}));
 assert.equal(eliminationResultLabel({winner:'double_dq',redScore:0,blueScore:0}),'Double DQ');
 assert.equal(eliminationResultLabel({winner:'tie',redScore:12,blueScore:12}),'Tie');
 assert.match(eliminationResultLabel({winner:'tie',redScore:0,blueScore:0}),/unconfirmed/);
});
