import {test} from 'node:test';
import assert from 'node:assert/strict';
import {iqScore,iqFinalPairs,parseIQMatches} from '../src/iq/iqWorkflows.js';
const csv=text=>text.trim().split(/\r?\n/).map(line=>line.split(','));
test('Level Up scoring counts each bag at one level, validates quantities and preserves zero',()=>{
 assert.equal(iqScore({floor:1,l1:2,l2:3,l3:4,l4:5}),153);
 assert.equal(iqScore({}),0);
 for(const counts of [{floor:-1},{l1:1.5},{l4:7},{floor:33,l2:6},{l3:'x'}])assert.throws(()=>iqScore(counts));
});
test('ranked finals play lowest seed first and reject incomplete/tied ranks',()=>{
 const teams=Array.from({length:6},(_,i)=>({number:`${i+1}A`,rank:i+1}));
 const rows=iqFinalPairs(teams,3);
 assert.deepEqual(rows.map(r=>r.red),[['5A','6A'],['3A','4A'],['1A','2A']]);
 assert.deepEqual(rows.map(r=>r.num),[1,2,3]);assert.ok(rows.every(r=>r.phase==='final'&&r.blue.length===0));
 assert.throws(()=>iqFinalPairs(teams,4));assert.throws(()=>iqFinalPairs([...teams.slice(0,5),{number:'6A',rank:5}],3));assert.throws(()=>iqFinalPairs(teams,1.5));
});
test('IQ CSV shared scores, blank versus zero, finals and one-team arrangements',()=>{
 const rows=parseIQMatches('Round,Match,Team1,Team2,Field,Score\nQualification,1,123A,456B,Field 1,0\nQualification,2,123A,789C,Field 2,\nFinals,1,123A,,Field 1,40','test.csv',csv);
 assert.equal(rows[0].redScore,0);assert.equal(rows[0].blueScore,null);assert.equal(rows[0].winner,null);
 assert.equal(rows[1].redScore,undefined);assert.deepEqual(rows[2].red,['123A']);assert.equal(rows[2].phase,'final');
 const tm=parseIQMatches('Round,MatchNum,Red1,Blue1,RedScore,BlueScore,Scored\n5,1,123A,456B,42,0,true','tm.csv',csv);
 assert.equal(tm[0].phase,'final');assert.deepEqual(tm[0].red,['123A','456B']);assert.deepEqual(tm[0].blue,[]);
});
test('IQ importer rejects four opposing teams, duplicate identities and invalid scores',()=>{
 for(const body of ['Round,Match,Red1,Red2,Blue1,Blue2\nQualification,1,1A,2A,3A,4A','Round,Match,Team1,Team2,Score\nFinals,1,1A,2A,10\nFinals,1,3A,4A,20','Round,Match,Team1,Team2,Score\nQualification,1,1A,1A,10','Round,Match,Team1,Team2,Score\nQualification,1,1A,2A,-1','Round,Match,Team1,Team2,RedScore,BlueScore\nQualification,1,1A,2A,10,20'])assert.throws(()=>parseIQMatches(body,'test.csv',csv));
});
test('IQ JSON and unscored rows never supply a score that clears saved results',()=>{
 const rows=parseIQMatches(JSON.stringify([{phase:'qual',num:1,teams:['1A','2B'],score:0},{phase:'final',num:1,red:['3A','4A'],blue:[],redScore:20,scored:false}]),'test.json',csv);
 assert.equal(rows[0].redScore,0);assert.equal(rows[1].redScore,undefined);
});
