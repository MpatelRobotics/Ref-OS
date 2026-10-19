import {test} from 'node:test';
import assert from 'node:assert/strict';
import {refereeService,serviceSummaryCsv} from '../src/refereeService.js';
import {matchesRefereeFilters} from '../src/refereeEventFilters.js';
test('service days deduplicate overlapping dates and cross-year ranges',()=>{
 const events=[{id:'a',name:'First',code:'RE-V5RC-26-1111',start_date:'2025-12-31',end_date:'2026-01-02'},{id:'b',name:'Second',start_date:'2026-01-02',end_date:'2026-01-03'},{id:'c',name:'Undated'}];
 const plans=events.map(e=>({event_id:e.id,attendance:'attended'}));
 const summary=refereeService(events,plans,[],2026,'2026-10-19');assert.equal(summary.days,3);assert.equal(summary.eventCount,2);assert.equal(summary.undated,1);
 assert.equal(refereeService(events,plans,[],null,'2026-10-19').days,4);
 assert.match(serviceSummaryCsv(summary,2026,'=danger'),/"'=danger"/);
 assert.equal(matchesRefereeFilters({code:'VE-V5-27-1234',name:'Signature Event'},'V5RC','signature'),true);
 assert.equal(matchesRefereeFilters({code:'RE-VIQRC-26-1234',eventType:'league'},'V5RC','league'),false);
});
