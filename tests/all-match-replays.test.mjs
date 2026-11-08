import test from 'node:test';
import assert from 'node:assert/strict';
import {tmMatchIdentity,tmMatchOrder,latestTmAttempts} from '../src/tmMatchIdentity.js';
import {eliminationGameLabel,eliminationResultLabel} from '../src/tmReplayGrouping.js';
import {mapVexScores} from '../supabase/functions/vex-event-lookup/matches.js';
import {tmMatchHighlights} from '../src/tmMatchHighlights.js';
import {parseIQMatches} from '../src/iq/iqWorkflows.js';
for(const [round,phase,apiRound,prefix] of [['PRACTICE','practice',1,'P'],['QUAL','qual',2,'Q'],['FINAL','final',5,'F']]){
 test(`${phase}: TM and VEX preserve both tied original and decisive rerun with matching identities`,()=>{
  const first=tmMatchIdentity({round,match:6,instance:1}),replay=tmMatchIdentity({round,match:6,instance:2});
  assert.deepEqual(first,{phase,num:6});assert.deepEqual(replay,{phase,num:1000006});
  const make=(instance,r,b)=>({round:apiRound,matchnum:6,instance,scored:true,alliances:[{color:'red',score:r,teams:[{team:{name:'1A'}},{team:{name:'2A'}}]},{color:'blue',score:b,teams:[{team:{name:'3A'}},{team:{name:'4A'}}]}]});
  const rows=mapVexScores([make(1,52,52),make(2,14,94)]);
  assert.deepEqual(rows.map(m=>({phase:m.phase,num:m.num})),[first,replay]);
  assert.equal(eliminationGameLabel(rows[0],rows),`${prefix}6-1`);assert.equal(eliminationGameLabel(rows[1],rows),`${prefix}6-2`);
  assert.equal(eliminationResultLabel(rows[0]),'Tie');
  assert.equal(latestTmAttempts(rows).length,1);assert.equal(latestTmAttempts(rows)[0].redScore,14);
  assert.deepEqual([replay,{phase,num:7},first].sort(tmMatchOrder).map(m=>m.num),[6,1000006,7]);
  assert.equal(mapVexScores([make(1,52,52)]).length,1);
  assert.equal(eliminationGameLabel(first,[first]),null);
 });
}
test('playing highlight resolves qualification rerun rather than original game',()=>{
 const matches={a:{id:'a',phase:'qual',num:6,redScore:52,blueScore:52},b:{id:'b',phase:'qual',num:1000006}};
 const highlights=tmMatchHighlights(matches,{updatedAt:100,fieldSets:[{connected:true,fields:[{status:'playing',match:{round:'QUAL',match:6,instance:2}}]}]},100);
 assert.equal(highlights.b,'current');assert.equal(highlights.a,undefined);
});
test('invalid replay identities cannot collide with normal matches; legacy instance zero stays original',()=>{
 assert.deepEqual(tmMatchIdentity({round:'QUAL',match:6,instance:0}),{phase:'qual',num:6});
 assert.equal(tmMatchIdentity({round:'QUAL',match:1000006,instance:1}),null);
 assert.equal(tmMatchIdentity({round:'PRACTICE',match:6,instance:-1}),null);
});
test('IQ JSON imports retain explicit qualification and finals rerun instances',()=>{
 const rows=parseIQMatches(JSON.stringify([{round:'Qualification',match:6,instance:1,teams:['7','9'],score:52},{round:'Qualification',match:6,instance:2,teams:['7','9'],score:60}]),'schedule.json');
 assert.deepEqual(rows.map(m=>m.num),[6,1000006]);
});
