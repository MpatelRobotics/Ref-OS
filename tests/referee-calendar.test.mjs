import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarDate,upcomingRefereeEvents,refereeCalendar} from '../src/refereeCalendar.js';
test('next event merges saved events, skips past/archive/undated and deduplicates',()=>{
 const events=[{id:'a',code:'RE-V5RC-26-1234',name:'Event',start_date:'2026-10-20',end_date:'2026-10-22'},{id:'b',name:'Archived',start_date:'2026-10-19',archivedAt:'yes'}];
 const plans=[{event_id:'a',attendance:'going'},{event_id:'b',attendance:'going'}];
 const external=[{code:'RE-V5RC-26-1234',name:'Event',start_date:'2026-10-20',end_date:'2026-10-22',attendance:'going'},{code:'old',name:'Old',start_date:'2026-01-01',attendance:'going'},{code:'undated',name:'Undated',attendance:'going'}];
 const rows=upcomingRefereeEvents(events,plans,external,'2026-10-19');assert.equal(rows.length,1);assert.equal(rows[0].id,'a');
 assert.equal(upcomingRefereeEvents(events,plans,external,'2026-10-21').length,1);
 assert.equal(upcomingRefereeEvents(events,plans,external,'2026-10-23').length,0);
});
test('calendar has exclusive end dates, safe escaping, valid CRLF and UTF8 line folding',()=>{
 const value=refereeCalendar([{code:'RE-V5RC-26-1234',name:'Event, One;\\\nSecond line',startDate:'2026-12-31',endDate:'2027-01-02',location:'é'.repeat(100)}],new Date('2026-10-19T12:00:00Z'));
 assert.match(value,/DTSTART;VALUE=DATE:20261231/);assert.match(value,/DTEND;VALUE=DATE:20270103/);assert.match(value,/SUMMARY:Event\\, One\\;\\\\\\nSecond line/);
 assert.ok(value.split('\r\n').every(line=>Buffer.byteLength(line,'utf8')<=75));
 assert.equal(calendarDate('2026-02-30'),'');assert.equal(calendarDate('2026-10-20T00:00:00Z'),'2026-10-20');
});
