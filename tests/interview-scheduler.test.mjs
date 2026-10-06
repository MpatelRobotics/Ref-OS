import test from 'node:test';
import assert from 'node:assert/strict';
import {addInterviewSlots,validateInterviews,localInterviewTime} from '../src/interviewSchedule.js';
test('slots use configured length, numeric team order and do not duplicate already scheduled teams',()=>{
 const slots=addInterviewSlots([],['10A','2A'],'2026-10-06T09:00',15,'Panel 1');
 assert.deepEqual(slots.map(slot=>slot.team),['2A','10A']);assert.equal(Date.parse(slots[1].start)-Date.parse(slots[0].start),15*60000);
 const added=addInterviewSlots(slots,['2A','3A'],'2026-10-06T10:00',5,'Panel 1');assert.equal(added.length,3);assert.equal(added[2].minutes,5);
 assert.equal(localInterviewTime(slots[0].start),'2026-10-06T09:00');
});
test('overlapping panel slots are rejected, adjacent times and independent panels are allowed',()=>{
 const slots=addInterviewSlots([],['2A','10A'],'2026-10-06T09:00',15,'Panel 1');assert.equal(validateInterviews(slots),'');
 const bad=slots.map(slot=>({...slot}));bad[1].start=new Date(Date.parse(bad[0].start)+14*60000).toISOString();bad[1].panel=' panel 1 ';assert.match(validateInterviews(bad),/overlap/);
 bad[1].panel='Panel 2';assert.equal(validateInterviews(bad),'');
});
test('invalid durations, missing times and duplicate teams cannot be saved',()=>{
 assert.throws(()=>addInterviewSlots([],['2A'],'2026-10-06T09:00',0,'Panel 1'),/1 to 120/);
 assert.throws(()=>addInterviewSlots([],['2A'],'invalid',10,'Panel 1'),/valid/);
 const slots=addInterviewSlots([],['2A'],'2026-10-06T09:00',10,'Panel 1');assert.match(validateInterviews([...slots,{...slots[0],id:'another'}]),/only one/);
 assert.match(validateInterviews([{...slots[0],minutes:2.5}]),/valid start/);
});
