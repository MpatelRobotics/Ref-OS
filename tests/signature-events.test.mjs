import test from 'node:test';
import assert from 'node:assert/strict';
import {groupEventsByState} from '../src/eventStateGroups.js';
test('signature events appear in both their state and signature groups',()=>{
 const signature={id:'s',country:'US',state:'KY',signatureEvent:true};
 const regular={id:'r',country:'US',state:'KY'};
 const groups=groupEventsByState([signature,regular]);
 assert.deepEqual(groups.map(g=>[g.name,g.events.map(e=>e.id)]),[['Signature Events',['s']],['KY Events',['s','r']]]);
 assert.equal(groupEventsByState([regular]).some(g=>g.name==='Signature Events'),false);
 assert.equal(groupEventsByState([{...signature,signatureEvent:false}]).length,1);
});
