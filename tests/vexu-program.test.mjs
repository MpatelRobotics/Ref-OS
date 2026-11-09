import test from 'node:test';
import assert from 'node:assert/strict';
import {eventCodeProgram,detectCompetitionProgram,assertEventCodeProgram} from '../supabase/functions/_shared/competitionProgram.js';
import {normalizeTmSnapshot} from '../src/tmSnapshot.js';
import {mapVexScores,fetchVexStandings} from '../supabase/functions/vex-event-lookup/matches.js';
import {lookupEvent} from '../supabase/functions/vex-event-lookup/lookup.js';
import {planMissingVexMatches} from '../src/vexScoreSync.js';
test('VEX U code category is distinct from V5 and IQ, regardless of metadata labels',()=>{
 for(const code of ['VE-U-26-66279','RE-VURC-26-1234','RE-VEXU-26-1234']){assert.equal(eventCodeProgram(code),'vexu');assert.doesNotThrow(()=>assertEventCodeProgram(code,'vexu'));}
 for(const code of ['VE-V5-27-12345','RE-V5RC-26-1234','VE-IQ-27-12345','RE-VIQRC-26-1234',''])assert.throws(()=>assertEventCodeProgram(code,'vexu'),/VEX U/);
 assert.equal(detectCompetitionProgram({code:'VE-V5-27-12345',program:'VEX U'}),'v5');
 assert.equal(detectCompetitionProgram({program:'VEX U Robotics Competition'}),'vexu');
 assert.throws(()=>assertEventCodeProgram('VE-U-26-66279','v5'),/V5RC/);
});
test('wrong-category lookups and live requests are rejected before upstream data is read',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('Unexpected request');};
 await assert.rejects(lookupEvent('VE-V5-27-12345','test',fetcher,'vexu'),/VEX U/);
 await assert.rejects(fetchVexStandings('VE-IQ-27-12345',1,'test',fetcher,'scores','vexu'),/VEX U/);
 assert.equal(calls,0);
});
test('VEX U TM snapshot accepts one team per side and rejects V5/IQ/unknown codes',()=>{
 const data={event:{name:'University event',code:'VE-U-26-66279'},teams:[{number:'BLRS'},{number:'WPI'}],rankings:[],skills:[],matches:[{matchInfo:{state:'SCORED',matchTuple:{session:0,round:'QUAL',match:1,instance:1},alliances:[{teams:[{number:'BLRS'}]},{teams:[{number:'WPI'}]}]},finalScore:[52,94]}]};
 const snapshot=normalizeTmSnapshot(data,undefined,'vexu');assert.equal(snapshot.program,'vexu');assert.equal(snapshot.matches.length,1);assert.deepEqual(snapshot.scores[0].red,['BLRS']);
 assert.equal(planMissingVexMatches([],snapshot.matches,'vexu').length,1);assert.equal(planMissingVexMatches([],snapshot.matches,'v5').length,0);
 for(const code of ['VE-V5-27-12345','VE-IQ-27-12345',''])assert.throws(()=>normalizeTmSnapshot({...data,event:{...data.event,code}},undefined,'vexu'),/VEX U/);
});
test('VEX U public scores keep one-team alliances and remain incompatible with V5 mapping',()=>{
 const row={round:2,matchnum:1,instance:1,scored:true,alliances:[{color:'red',score:52,teams:[{team:{name:'BLRS'}}]},{color:'blue',score:94,teams:[{team:{name:'WPI'}}]}]};
 assert.equal(mapVexScores([row],true,'vexu').length,1);assert.equal(mapVexScores([row],true,'v5').length,0);
});
