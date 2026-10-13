import test from 'node:test';
import assert from 'node:assert/strict';
import {optimizeInterviews,optimizeJudgeGroups} from '../src/interviewOptimizer.js';
import {validateInterviews} from '../src/interviewSchedule.js';
import {matchInterviewConflicts} from '../src/interviewPlanning.js';
const time=t=>`2026-10-13T${t}:00.000Z`;
const base={teams:['10A','2A','3A'],start:time('09:00'),end:time('11:00'),minutes:10,buffer:5,panels:['P1']};
test('named judge groups divide teams evenly with independent panels and preserve assignments',()=>{
 const result=optimizeJudgeGroups({...base,teams:['1A','2A','3A','4A','5A'],groupNames:['Alpha','Beta'],panelPrefix:'Room'});
 assert.deepEqual(result.groups.map(g=>g.teams.length),[3,2]);assert.equal(new Set(result.entries.map(r=>r.team)).size,5);assert.equal(validateInterviews(result.entries),'');assert.deepEqual(result.entries.filter(r=>r.group==='Beta').map(r=>r.panel),['Room 2','Room 2']);
 assert.throws(()=>optimizeJudgeGroups({...base,groupNames:['Same','same']}),/unique/);
 const limited=optimizeJudgeGroups({...base,end:time('09:15'),groupNames:['Alpha','Beta']});assert.equal(limited.groups[0].teams.length,2);assert.equal(limited.unplaced.length,1);
});
test('no-match proposal uses numeric order and preserves existing reservations',()=>{
 const existing=[{id:'saved',team:'2A',start:time('09:00'),minutes:20,buffer:5,panel:'P1'}];
 const result=optimizeInterviews({...base,existing});assert.deepEqual(result.entries.map(r=>r.team),['3A','10A']);assert.equal(result.entries[0].start,time('09:25'));assert.equal(validateInterviews([...existing,...result.entries]),'');assert.equal(existing[0].start,time('09:00'));
});
test('match-aware order gives constrained teams earlier slots and avoids matches',()=>{
 const matches=[{red:['10A'],blue:[],scheduledAt:time('09:30')}];const result=optimizeInterviews({...base,matches});assert.equal(result.entries[0].team,'10A');for(const r of result.entries)assert.equal(matchInterviewConflicts(r,matches).length,0);
});
test('lunch exclusion skips the block including buffers; lunch-only stays inside it',()=>{
 const lunch={lunchStart:time('09:15'),lunchEnd:time('10:00')};const avoid=optimizeInterviews({...base,...lunch,lunchMode:'avoid'});assert.deepEqual(avoid.entries.map(r=>r.start),[time('09:00'),time('10:00'),time('10:15')]);const only=optimizeInterviews({...base,...lunch,lunchMode:'only'});assert.deepEqual(only.entries.map(r=>r.start),[time('09:15'),time('09:30'),time('09:45')]);assert.throws(()=>optimizeInterviews({...base,lunchMode:'avoid'}),/lunch/);
});
test('limited capacity reports unplaced teams and independent panels run concurrently',()=>{
 const one=optimizeInterviews({...base,end:time('09:15')});assert.equal(one.entries.length,1);assert.equal(one.unplaced.length,2);const two=optimizeInterviews({...base,end:time('09:15'),panels:['P1','P2']});assert.equal(two.entries.length,2);assert.equal(validateInterviews(two.entries),'');assert.equal(two.entries[0].start,two.entries[1].start);
});
test('invalid windows, panels and duration reject instead of producing unsafe schedules',()=>{
 assert.throws(()=>optimizeInterviews({...base,end:time('08:00')}),/window/);assert.throws(()=>optimizeInterviews({...base,panels:['P1','p1']}),/distinct/);assert.throws(()=>optimizeInterviews({...base,minutes:0}),/length/);
});
