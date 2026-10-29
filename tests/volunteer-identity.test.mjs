import {test} from 'node:test';
import assert from 'node:assert/strict';
import {volunteerMember,volunteerLocation} from '../src/volunteerIdentity.js';
test('demo visitors with the same name keep separate assignments, including Unassigned',()=>{
 const members=[{user_id:'other',name:'Demo Ref'},{user_id:'me',name:'Demo Ref'}];
 const assignments={other:{name:'Demo Ref',location:'Field 3'}};
 assert.equal(volunteerMember(members,'me','Demo Ref'),members[1]);
 assert.equal(volunteerLocation(assignments,'me','Demo Ref'),'');
 assignments.me={name:'Demo Ref',location:'Field 1'};
 assert.equal(volunteerLocation(assignments,'me','Demo Ref'),'Field 1');
 delete assignments.me;
 assert.equal(volunteerLocation(assignments,'me','Demo Ref'),'');
 assert.equal(volunteerLocation(assignments,'other','Demo Ref'),'Field 3');
 assert.equal(volunteerMember(members,'not-loaded','Demo Ref'),null);
 assert.equal(volunteerMember(members,null,'Demo Ref'),null);
});
test('legacy name lookup works only for a unique match',()=>{
 assert.equal(volunteerLocation({a:{name:'Ref',location:'Skills'}},null,'ref'),'Skills');
 assert.equal(volunteerLocation({a:{name:'Ref',location:'Skills'},b:{name:'Ref',location:'Field 3'}},null,'ref'),'');
});
