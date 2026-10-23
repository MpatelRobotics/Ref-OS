import test from 'node:test';
import assert from 'node:assert/strict';
import { partitionScheduledTeams } from '../src/scheduledTeams.js';
const teams=[{number:'1A',name:'First',photoKeys:['photo']},{number:'2B'},{number:'3C'}];
test('hides only unscheduled teams without changing their records',()=>{
 const result=partitionScheduledTeams(teams,{'1':{red:['1A'],blue:['2B']}},true);
 assert.deepEqual(result.scheduled,teams.slice(0,2));assert.deepEqual(result.unscheduled,[teams[2]]);
 assert.equal(result.scheduled[0],teams[0]);assert.equal(teams[0].photoKeys[0],'photo');assert.equal(teams.length,3);
});
test('empty schedule or inactive filter keeps every team visible',()=>{
 assert.equal(partitionScheduledTeams(teams,{},true).scheduled,teams);
 assert.equal(partitionScheduledTeams(teams,{'1':{red:['1A']}},false).scheduled,teams);
});
test('newly scheduled teams return automatically and sessions use their own matches',()=>{
 assert.deepEqual(partitionScheduledTeams(teams,[{red:['3C'],blue:[]}],true).scheduled,[teams[2]]);
 assert.deepEqual(partitionScheduledTeams(teams,[{red:['1A','2B'],blue:['3C']}],true).unscheduled,[]);
});
