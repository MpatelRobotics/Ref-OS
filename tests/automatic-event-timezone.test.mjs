import test from 'node:test';
import assert from 'node:assert/strict';
import {detectVexTimezone} from '../supabase/functions/_shared/eventTimezone.js';
import {saveDetectedEventTimezone} from '../src/detectedEventTimezone.js';
test('published event timezone takes precedence over coordinates and abbreviations are not guessed',()=>{
 assert.deepEqual(detectVexTimezone({timezone:'Asia/Tokyo',location:{coordinates:{lat:40.71,lon:-74}}}),{timezone:'Asia/Tokyo',timezoneSource:'VEX event'});
 assert.equal(detectVexTimezone({timezone:'EST',location:{}}).timezone,null);
});
test('venue coordinates detect North American and international event zones',()=>{
 for(const [lat,lon,zone] of [[40.7128,-74.006,'America/New_York'],[45.205,-72.745,'America/Toronto'],[51.5074,-0.1278,'Europe/London'],[28.6139,77.209,'Asia/Kolkata'],[-33.8688,151.2093,'Australia/Sydney']])assert.equal(detectVexTimezone({location:{coordinates:{lat,lon}}}).timezone,zone);
});
test('missing, zero or invalid coordinates never choose a zone for multi-zone countries',()=>{
 for(const coordinates of [{lat:null,lon:null},{lat:0,lon:0},{lat:200,lon:30},{lat:'',lon:''}])assert.equal(detectVexTimezone({location:{country:'Canada',coordinates}}).timezone,null);
 assert.ok(['Asia/Calcutta','Asia/Kolkata'].includes(detectVexTimezone({location:{country:'India'}}).timezone));
});
test('detected timezone saves when absent, preserves manual choice, and follows an automatic code change',async()=>{
 let row=null;const writes=[];
 const api={getEventSetting:async()=>row,upsertEventSetting:async(id,key,value)=>{writes.push({id,key,value});return row={key,value};}};
 const details={code:'VE-U-26-66279',timezone:'America/Toronto',timezoneSource:'Venue coordinates'};
 await saveDetectedEventTimezone({api,eventId:'event',details});assert.equal(row.value.zone,'America/Toronto');
 await saveDetectedEventTimezone({api,eventId:'event',details});assert.equal(writes.length,1);
 row={value:{zone:'Europe/London'}};
 await saveDetectedEventTimezone({api,eventId:'event',details});assert.equal(writes.length,1);assert.equal(row.value.zone,'Europe/London');
 row={value:{zone:'Europe/London',source:'VEX event lookup',code:'RE-V5RC-26-1111'}};
 await saveDetectedEventTimezone({api,eventId:'event',details});assert.equal(writes.length,2);assert.equal(row.value.zone,'America/Toronto');
});
test('cancelled lookup and invalid timezone never write a setting',async()=>{
 let writes=0;const api={getEventSetting:async()=>null,upsertEventSetting:async()=>writes++};
 await saveDetectedEventTimezone({api,eventId:'event',details:{timezone:'Bad/Zone'}});
 await saveDetectedEventTimezone({api,eventId:'event',details:{timezone:'Asia/Tokyo'},current:()=>false});
 assert.equal(writes,0);
});
