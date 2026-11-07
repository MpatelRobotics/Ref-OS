import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTmSnapshot } from '../src/tmSnapshot.js';
import { applyTmSnapshot } from '../src/tmApplySnapshot.js';
import { planMissingVexMatches, planScoreUpdates } from '../src/vexScoreSync.js';
import { fetchVexStandings, mapVexScores, mapVexRankings } from '../supabase/functions/vex-event-lookup/matches.js';
const match=(num=1,state='SCORED',scores=[0])=>({matchInfo:{state,matchTuple:{session:0,round:'QUAL',match:num,instance:1},alliances:[{teams:[{number:7},{number:'9'}]}]},finalScore:scores});
const fixture=()=>({event:{name:'IQ test',code:'VE-IQ-27-12345'},teams:[{number:7,name:'Seven'},{number:'9',name:'Nine'}],matches:[match(),match(2,'UNPLAYED')],rankings:[{rank:1,alliance:{teams:[{number:7}]},averageScore:42.5,matchesPlayed:6}],skills:[{rank:1,number:7,totalScore:50,driverHighScore:30,progHighScore:20}]});
test('TM IQ keeps numeric partners, shared zero, official averages, skills and unscored schedules',()=>{
 const snapshot=normalizeTmSnapshot(fixture(),undefined,'iq');
 assert.equal(snapshot.matches.length,2);assert.equal(snapshot.scores.length,1);
 assert.deepEqual(snapshot.scores[0],{phase:'qual',num:1,red:['7','9'],blue:[],program:'iq',redScore:0,blueScore:null,winner:null});
 assert.equal(snapshot.rankings[0].avgPoints,42.5);assert.equal(snapshot.rankings[0].played,6);
 assert.equal(snapshot.skills[0].programming,20);
 assert.throws(()=>normalizeTmSnapshot(fixture()),/program/);
});
test('IQ rejects opposing teams/scores, duplicated identities and elimination rounds',()=>{
 const data=fixture();data.matches=[match(1,'SCORED',[20,19]),match(2),match(2),{...match(3),matchInfo:{...match(3).matchInfo,alliances:[{teams:[{number:'7'},{number:'9'},{number:'10'}]}]}},{...match(4),matchInfo:{...match(4).matchInfo,matchTuple:{session:0,round:'QF',match:1,instance:1}}}];
 assert.equal(normalizeTmSnapshot(data,undefined,'iq').matches.length,0);
});
test('IQ writes shared scores through guarded matching and saves average/played records',async()=>{
 const snapshot=normalizeTmSnapshot(fixture(),undefined,'iq'), matches=[],writes=[],settings=[];
 const api={listTeams:async()=>snapshot.teams,bulkUpsertTeams:async()=>{},listMatches:async()=>matches,insertTmMatch:async(_,m)=>{matches.push({...m,redScore:null,blueScore:null});return true;},updateExistingVexScore:async(_,m)=>{writes.push(m);return 1;},bulkUpsertRankings:async()=>{},upsertEventSetting:async(_,key,value)=>settings.push({key,value})};
 await applyTmSnapshot(snapshot,{api,eventId:'test',by:'Admin',includeSchedule:true,hashes:{},current:()=>true});
 assert.equal(matches.length,2);assert.equal(writes.length,1);assert.equal(writes[0].program,'iq');assert.equal(writes[0].blueScore,null);
 assert.equal(settings.find(s=>s.key==='qualification_records').value.records['7'].avgPoints,42.5);
 assert.equal(planScoreUpdates([{...matches[0],red:['8','9']}],snapshot.scores).updates.length,0);
});
const publicMatch={round:2,matchnum:1,scored:true,alliances:[{color:'red',score:0,teams:[{team:{name:'7'}},{team:{name:'9'}}]}]};
test('VEX IQ accepts one teamwork alliance, shared zero and finals; V5 stays separate',()=>{
 const rows=mapVexScores([publicMatch,{...publicMatch,round:5,matchnum:2}],true,'iq');
 assert.equal(rows.length,2);assert.equal(rows[0].redScore,0);assert.equal(rows[0].blueScore,null);assert.equal(rows[1].phase,'final');
 assert.equal(mapVexScores([publicMatch]).length,0);
 assert.equal(mapVexScores([{...publicMatch,scored:false}],true,'iq').length,0);
 assert.equal(planMissingVexMatches([],rows,'iq').length,2);assert.equal(planMissingVexMatches([],rows).length,0);
 const rankings=mapVexRankings([{team:{name:'7'},rank:1,average_points:32.5,matches_played:4}],'iq');
 assert.equal(rankings[0].avgPoints,32.5);assert.equal(rankings[0].played,4);
});
test('VEX IQ snapshot selects program and fetches roster, schedule and scores',async()=>{
 const fetcher=async url=>{
  const u=new URL(url);let data;
  if(u.pathname.endsWith('/events'))data={data:[{id:1,sku:'VE-IQ-27-12345'}]};
  else if(u.pathname.endsWith('/events/1'))data={program:{name:'VEX IQ Robotics Competition'},divisions:[{id:1,name:'IQ'}]};
  else if(u.pathname.endsWith('/teams'))data={data:[{number:'7',team_name:'Seven'}],meta:{last_page:1}};
  else data={data:[publicMatch],meta:{last_page:1}};
  return new Response(JSON.stringify(data));
 };
 const data=await fetchVexStandings('VE-IQ-27-12345',1,'test-token',fetcher,'scores');
 assert.equal(data.program,'iq');assert.equal(data.scores.length,1);assert.equal(data.matches.length,1);assert.equal(data.scoreSummary.unsupported,0);
 assert.deepEqual(data.teams,[{number:'7',name:'Seven'}]);
});
