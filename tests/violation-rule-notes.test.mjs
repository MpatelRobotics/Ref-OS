import test from 'node:test';
import assert from 'node:assert/strict';
import {parseViolationRuleNotes,validViolationRuleDetails,formatViolationRuleNotes} from '../src/violationRuleNotes.js';
test('SG9 and SG10 details are optional; entered counts must be positive whole numbers',()=>{
 const empty=parseViolationRuleNotes().details;
 assert.equal(validViolationRuleDetails(['SG9','SG10'],empty),true);
 for(const action of ['Touch','Descore']){
  assert.equal(validViolationRuleDetails(['SG9'],{...empty,sg9Action:action}),true);
  for(const count of ['0','-1','1.5'])assert.equal(validViolationRuleDetails(['SG9'],{...empty,sg9Action:action,sg9Count:count}),false);
  assert.equal(validViolationRuleDetails(['SG9'],{...empty,sg9Action:action,sg9Count:'3'}),true);
 }
 for(const action of ['Cover','Push'])assert.equal(validViolationRuleDetails(['SG9'],{...empty,sg9Action:action}),true);
 assert.equal(validViolationRuleDetails(['SG10'],empty),true);
 assert.equal(validViolationRuleDetails(['SG10'],{...empty,sg10Count:'4'}),true);
 assert.equal(validViolationRuleDetails([],empty),true);
});
test('editing restores details without duplicating notes and deselecting removes automatic details',()=>{
 const details={sg9Action:'Descore',sg9Count:'2',sg10Count:'3'};
 const notes=formatViolationRuleNotes('Ref spoke to team.',['SG9','SG10'],details);
 assert.equal(notes,'Ref spoke to team.\n[SG9] Descore; count: 2\n[SG10] Descored: 3');
 assert.deepEqual(parseViolationRuleNotes(notes),{notes:'Ref spoke to team.',details});
 assert.equal(formatViolationRuleNotes('Ref spoke to team.',[],details),'Ref spoke to team.');
 assert.equal(formatViolationRuleNotes('', ['SG9'],{...details,sg9Action:'Push'}),'[SG9] Push');
 assert.equal(formatViolationRuleNotes('', ['SG9','SG10'],parseViolationRuleNotes().details),'');
 assert.equal(formatViolationRuleNotes('', ['SG9'],{...details,sg9Action:'Touch',sg9Count:''}),'[SG9] Touch');
});
