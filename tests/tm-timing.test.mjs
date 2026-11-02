import test from 'node:test';
import assert from 'node:assert/strict';
import {applyFieldEvent} from '../src/tmFieldEvent.js';
import {scopeTmFieldActivity} from '../src/tmFieldActivity.js';
import {mergeTmTiming,timingMetrics} from '../src/tmTiming.js';
const tuple={division:1,session:0,round:'QUAL',match:1,instance:1};
const set=()=>({id:1,name:'Main',connected:true,fields:[{id:1,name:'Field 1'}]});
test('captures assignment/start/stop, preserves repeated runs and scopes history',()=>{
 const s=set();applyFieldEvent(s,{type:'fieldMatchAssigned',fieldID:1,match:tuple},1000);applyFieldEvent(s,{type:'matchStarted',fieldID:1},2000);applyFieldEvent(s,{type:'matchStarted',fieldID:1},2500);applyFieldEvent(s,{type:'matchStopped',fieldID:1},5000);applyFieldEvent(s,{type:'matchStopped',fieldID:1},6000);
 assert.equal(s.fields[0].startedAt,2000);assert.equal(s.fields[0].stoppedAt,5000);
 applyFieldEvent(s,{type:'matchStarted',fieldID:1},7000);
 assert.equal(s.fields[0].timingHistory.length,2);
 applyFieldEvent(s,{type:'fieldMatchAssigned',fieldID:1,match:{...tuple,division:2}},8000);
 const scoped=scopeTmFieldActivity({fieldSets:[s]},2,0);assert.equal(scoped[0].fields[0].timingHistory.length,0);
 assert.equal(s.fields[0].timingHistory.length,2);
});
test('records score observation after stop, computes stages and team-matched delay',()=>{
 const s=set();const activity={fieldSets:[s]};const m={phase:'qual',num:1,red:['1A'],blue:['2A']};
 applyFieldEvent(s,{type:'fieldMatchAssigned',fieldID:1,match:tuple},1000);applyFieldEvent(s,{type:'matchStarted',fieldID:1},2000);
 let rows=mergeTmTiming(null,activity,[m],2500);
 applyFieldEvent(s,{type:'matchStopped',fieldID:1},5000);rows=mergeTmTiming({timing:rows},activity,[{...m,redScore:0,blueScore:20}],6000);
 applyFieldEvent(s,{type:'fieldMatchAssigned',fieldID:1,match:{...tuple,match:2}},6500);applyFieldEvent(s,{type:'matchStarted',fieldID:1},8000);
 rows=mergeTmTiming({timing:rows},activity,[],9000);
 const metrics=timingMetrics(rows,[{...m,scheduledAt:new Date(1500).toISOString()}],[m]);
 assert.equal(metrics[0].delayMs,500);assert.equal(metrics[0].setupMs,1000);assert.equal(metrics[0].playMs,3000);assert.equal(metrics[0].scoringMs,1000);assert.equal(metrics[0].turnoverMs,2000);assert.equal(metrics[0].cycleMs,6000);
 assert.equal(timingMetrics(rows,[{...m,red:['9A'],scheduledAt:new Date(1500).toISOString()}],[m])[0].delayMs,null);
 assert.equal(mergeTmTiming({timing:rows},{fieldSets:[]},[],10000).length,2);
});
test('does not infer a finish, or use an old score for a replay',()=>{
 const s=set();applyFieldEvent(s,{type:'fieldMatchAssigned',fieldID:1,match:tuple},1000);applyFieldEvent(s,{type:'matchStarted',fieldID:1},2000);
 const scored={phase:'qual',num:1,redScore:10,blueScore:20};let rows=mergeTmTiming(null,{fieldSets:[s]},[scored],3000);
 assert.equal(timingMetrics(rows)[0].playMs,null);
 applyFieldEvent(s,{type:'matchStopped',fieldID:1},4000);rows=mergeTmTiming({timing:rows},{fieldSets:[s]},[scored],5000);assert.equal(rows[0].scoreObservedAt,undefined);
});
