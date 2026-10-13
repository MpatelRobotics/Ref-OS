import test from 'node:test';
import assert from 'node:assert/strict';
import {interviewMatchWindow,interviewMatchLabel,groupOptimizerEntries} from '../src/interviewMatchWindow.js';
const match=(num,time,team='1A')=>({phase:'qual',num,scheduledAt:`2026-10-13T${time}:00Z`,red:[team],blue:[]});
test('export finds the team-specific nearest preceding and following matches',()=>{
 const result=interviewMatchWindow({team:'1A',start:'2026-10-13T10:00:00Z',minutes:10},[match(1,'09:00'),match(5,'09:40'),match(6,'09:55','2A'),match(10,'10:30'),match(12,'11:00')]);assert.equal(result.after.num,5);assert.equal(result.before.num,10);assert.equal(interviewMatchLabel(result.after),'Q5');
});
test('missing times and match boundaries do not invent a window',()=>{
 const entry={team:'1A',start:'2026-10-13T10:00:00Z',minutes:10};assert.equal(interviewMatchWindow(entry,[]).known,0);assert.equal(interviewMatchWindow(entry,[{red:['1A'],blue:[]}]).unknown,1);const r=interviewMatchWindow(entry,[match(1,'10:05')]);assert.equal(r.after,null);assert.equal(r.before,null);assert.equal(r.overlapping.length,1);
});
test('elimination references show pairing and replay game instead of internal match IDs',()=>{assert.equal(interviewMatchLabel({phase:'qf',num:1002}),'QF2-2');});
test('group sections contain their teams in interview-time order and label unassigned teams',()=>{
 const rows=[{team:'2A',group:'B',start:'2026-10-13T11:00Z'},{team:'1A',group:'B',start:'2026-10-13T10:00Z'},{team:'3A',group:'A',start:'2026-10-13T10:00Z'},{team:'4A',start:'2026-10-13T10:00Z'}];const grouped=groupOptimizerEntries(rows);assert.deepEqual(grouped.map(g=>g.name),['A','B','Unassigned judge group']);assert.deepEqual(grouped[1].entries.map(e=>e.team),['1A','2A']);
});
