import test from 'node:test';
import assert from 'node:assert/strict';
import {mapVexScores,fetchVexStandings,describeVexScores} from '../supabase/functions/vex-event-lookup/matches.js';
import {planScoreUpdates} from '../src/vexScoreSync.js';
const row={round:2,matchnum:3,instance:1,scored:true,alliances:[{color:'red',score:10,teams:[{team:{name:'2A'}},{team:{name:'3B'}}]},{color:'blue',score:0,teams:[{team:{name:'4C'}},{team:{name:'5D'}}]}]};
test('scored results map with zero scores, unsupported rounds and unscored matches skip',()=>{const scores=mapVexScores([row,{...row,scored:false},{...row,round:9}]);assert.equal(scores.length,1);assert.deepEqual(scores[0],{phase:'qual',num:3,red:['2A','3B'],blue:['4C','5D'],redScore:10,blueScore:0});});
test('only existing matching matches update, no creation, reversed teams and duplicates skip',()=>{const score=mapVexScores([row])[0];const matches={'3':{...score,red:['3B','2A'],redScore:null,blueScore:null}};assert.equal(planScoreUpdates(matches,[score]).updates.length,1);assert.equal(planScoreUpdates({},[score]).updates.length,0);assert.equal(planScoreUpdates(matches,[score,score]).updates.length,0);assert.equal(planScoreUpdates(matches,[{...score,red:score.blue,blue:score.red}]).updates.length,0);assert.equal(planScoreUpdates({'3':score},[score]).updates.length,0);});
test('multi-game non-final series cannot collapse to one existing pairing score',()=>{assert.equal(mapVexScores([{...row,round:3,matchnum:1},{...row,round:3,matchnum:2}]).length,0);});
test('scores-only fetches division matches without returning schedule imports',async()=>{let n=0;const urls=[];const fetcher=async url=>{urls.push(String(url));n++;return new Response(JSON.stringify(n===1?{data:[{id:1,sku:'VE-V5-27-6588'}]}:n===2?{divisions:[{id:1,name:'Main'}]}:{data:[row],meta:{last_page:1}}));};const result=await fetchVexStandings('VE-V5-27-6588',1,'fixture-token',fetcher,'scores');assert.equal(result.scores.length,1);assert.ok(urls[2].includes('/divisions/1/matches?'));assert.equal(result.matches,undefined);});

test('VEX scored timestamps accept published scores including valid zero scores',()=>{
 const timestamp='2026-10-07T01:33:00+00:00';
 const q1={...row,matchnum:1,scored:timestamp,alliances:row.alliances.map(a=>({...a,score:a.color==='red'?133:0}))};
 const q2={...row,matchnum:2,scored:timestamp,alliances:row.alliances.map(a=>({...a,score:a.color==='red'?24:74}))};
 assert.deepEqual(mapVexScores([q1,q2]).map(m=>[m.num,m.redScore,m.blueScore]),[[1,133,0],[2,24,74]]);
 assert.equal(mapVexScores([{...q1,scored:'not-a-date'}]).length,0);
 assert.equal(mapVexScores([{...q1,alliances:q1.alliances.map(a=>({...a,score:0}))}]).length,1);
});

test('published scores without completion metadata import but placeholders and explicit unscored results skip',async()=>{
 const {scored,...published}=row;
 const q1={...published,matchnum:1,alliances:row.alliances.map(a=>({...a,score:a.color==='red'?133:0}))};
 const q2={...published,matchnum:2,alliances:row.alliances.map(a=>({...a,score:a.color==='red'?24:74}))};
 const placeholder={...published,alliances:row.alliances.map(a=>({...a,score:0}))};
 assert.deepEqual(mapVexScores([q1,q2]).map(m=>[m.num,m.redScore,m.blueScore]),[[1,133,0],[2,24,74]]);
 assert.equal(mapVexScores([{...q1,scored:null},{...q1,scored:''}]).length,2);
 assert.equal(mapVexScores([placeholder,{...q1,scored:false},{...q1,alliances:q1.alliances.map(a=>({...a,score:'133'}))}]).length,0);
 let n=0;
 const fetcher=async()=>new Response(JSON.stringify(++n===1?{data:[{id:1,sku:'VE-V5-26-65633'}]}:n===2?{divisions:[{id:1,name:'Main'}]}:{data:[q1,q2,placeholder],meta:{last_page:1}}));
 const result=await fetchVexStandings('VE-V5-26-65633',1,'fixture-token',fetcher,'scores');
 assert.equal(result.scores.length,2);
 assert.deepEqual(result.scoreSummary,{received:3,notScored:1,unsupported:0});
 assert.equal(planScoreUpdates(Object.fromEntries(result.scores.map(score=>[score.num,{...score,redScore:null,blueScore:null}])),result.scores).updates.length,2);
});

test('diagnostics distinguish API placeholders from rejected published scores without exposing raw data',()=>{
 const placeholders=Array.from({length:12},()=>({...row,scored:false,secret:'must-not-return',alliances:row.alliances.map(a=>({...a,score:0}))}));
 const empty=describeVexScores(placeholders,[]);
 assert.match(empty.message,/no nonzero alliance scores/);
 assert.equal(empty.samples.length,5);
 assert.equal(empty.samples[0].completion,'Marked unscored');
 assert.equal(JSON.stringify(empty).includes('must-not-return'),false);
 const rejected=describeVexScores([{...row,scored:false}],[]);
 assert.match(rejected.message,/nonzero scores/);
 assert.equal(rejected.samples[0].redScore,10);
 assert.match(describeVexScores([],[]).message,/no matches/);
 assert.match(describeVexScores([row],mapVexScores([row])).message,/ready to match/);
});
