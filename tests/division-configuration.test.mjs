import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeDivisions,validateDivisions,divisionFieldNames} from '../src/divisionConfiguration.js';
const fields={'Field 1':'Nucor Field','Field 2':'United Rentals Field','Field 3':'Central Kentucky Installers Field'};
test('sync overrides custom division names, keeps fallback fields and manually added divisions',()=>{
 const saved=[{id:1,name:'Tech Bridge Division',customName:true,fieldNames:fields,fieldCount:3},{id:7,name:'Skills'}];
 const merged=mergeDivisions(saved,[{id:1,name:'Division 1'},{id:2,name:'Division 2'}]);
 assert.equal(merged.find(d=>d.id===1).name,'Division 1');assert.equal(merged[0].customName,false);assert.deepEqual(merged[0].fieldNames,fields);assert.equal(merged.length,3);
 assert.equal(mergeDivisions([{id:1,name:'Old'}],[{id:1,name:'Updated'}])[0].name,'Updated');
});
test('field and division validation rejects ambiguous names without rejecting identical fields in separate divisions',()=>{
 const row={id:1,name:' One ',fieldCount:3,fieldNames:fields};
 assert.equal(validateDivisions([row,{...row,id:2,name:'Two'}])[0].name,'One');
 for(const rows of [[],[row,{...row,id:2,name:'one'}],[{...row,fieldNames:{...fields,'Field 2':'nucor field'}}],[{...row,fieldCount:0}],[row,{...row,name:'Two'}]])assert.throws(()=>validateDivisions(rows));
});
test('synced fields override fallback names while separate divisions retain their own manual names',()=>{
 assert.deepEqual(divisionFieldNames({fieldNames:fields},['Field 1','Field 2']),{});
 assert.equal(divisionFieldNames({fieldNames:fields})['Field 2'],'United Rentals Field');
 assert.equal(divisionFieldNames({fieldNames:{'Field 1':'Henkel'}})['Field 1'],'Henkel');
 assert.deepEqual(divisionFieldNames({fieldNames:fields},['Nucor','Other']),{});
});
