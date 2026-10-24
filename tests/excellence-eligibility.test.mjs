import test from 'node:test';
import assert from 'node:assert/strict';
import {excellenceEligibility,excellenceSnapshot,EXCELLENCE_CHECKS} from '../src/excellenceEligibility.js';
const teams=Array.from({length:10},(_,i)=>({number:String(i+1)+'A',rank:i+1}));
const skills=teams.map((t,i)=>({number:t.number,total:100-i,programming:50-i}));
test('evaluates entire roster without nominations, requires all eight criteria and final data',()=>{
 const review={final:true,snapshot:excellenceSnapshot(teams,skills),teams:{'1A':Object.fromEntries(EXCELLENCE_CHECKS.map(([k])=>[k,true]))}};
 const result=excellenceEligibility(teams,skills,review);
 assert.equal(result.length,10);assert.equal(result.filter(r=>r.performance).length,4);
 assert.deepEqual(result.filter(r=>r.eligible).map(r=>r.team.number),['1A']);
 assert.equal(excellenceEligibility(teams,skills,{...review,final:false}).some(r=>r.eligible),false);
 assert.equal(excellenceEligibility(teams,skills.slice(1),review).some(r=>r.eligible),false);
});
test('zero autonomous is never eligible, missing qualification data stays pending',()=>{
 assert.equal(excellenceEligibility(teams,skills.map(s=>({...s,programming:0}))).some(r=>r.performance),false);
 assert.ok(excellenceEligibility(teams.map(t=>({...t,rank:null})),skills).every(r=>r.pending));
});
test('grade-specific awards rank each level separately and require all assignments',()=>{
 const levels=Object.fromEntries(teams.map((t,i)=>[t.number,i<5?'middle':'high']));
 const rows=excellenceEligibility(teams,skills,{splitLevels:true,levels});
 assert.equal(rows.filter(r=>r.performance).length,4);
 assert.ok(rows.every(r=>r.cutoff===2));
 delete levels['1A'];
 assert.ok(excellenceEligibility(teams,skills,{splitLevels:true,levels}).every(r=>!r.eligible&&!r.performance));
});
test('teams without skills runs remain in denominator and ties share autonomous rank',()=>{
 const rows=excellenceEligibility(teams,skills.slice(0,2).map(s=>({...s,programming:5})));
 assert.equal(rows.length,10);assert.equal(rows.find(r=>r.team.number==='2A').ranks.autonomous,1);
 assert.equal(rows.find(r=>r.team.number==='10A').performance,false);
});
