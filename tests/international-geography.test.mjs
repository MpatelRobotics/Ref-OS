import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRIES,countryTimezones,timezoneCountry} from '../src/geography.js';
import {searchEvents} from '../supabase/functions/vex-event-lookup/lookup.js';
test('country timezone groups include US, international zones, aliases and explicit UTC',()=>{
 assert.ok(COUNTRIES.length>=240);
 assert.ok(countryTimezones('US').includes('America/New_York'));
 assert.ok(countryTimezones('IN').includes('Asia/Kolkata'));
 assert.ok(!countryTimezones('IN').includes('America/New_York'));
 assert.equal(timezoneCountry('Asia/Calcutta'),'IN');
 assert.ok(countryTimezones('IN','Asia/Calcutta').includes('Asia/Calcutta'));
 assert.deepEqual(countryTimezones('UTC'),['UTC']);
 assert.equal(timezoneCountry('UTC'),'UTC');assert.deepEqual(countryTimezones('XX'),[]);
});
test('international matching accepts country aliases and ignores unrelated state filters',async()=>{
 const filters={country:'GB',state:'New York',start:'2026-11-01',end:'2026-12-01'};
 const data=['UK','Great Britain','United Kingdom','GB','United States'].map((country,i)=>({sku:`VE-IQ-27-${12345+i}`,name:`Event ${i}`,start:'2026-11-10',location:{country,region:'England'},event_type:'Tournament'}));
 const result=await searchEvents(filters,'fixture-token',async()=>new Response(JSON.stringify({data,meta:{last_page:1}})));
 assert.equal(result.events.length,4);
 await assert.rejects(searchEvents({...filters,country:'XX'},'fixture-token'),/Enter a country/);
 await assert.rejects(searchEvents({...filters,country:'US',state:''},'fixture-token'),/US state/);
});
