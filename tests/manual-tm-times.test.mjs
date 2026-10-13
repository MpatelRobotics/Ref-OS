import test from 'node:test';import assert from 'node:assert/strict';
import {parseManualScheduledTime,mergeManualMatchTimes,isTmTimesOnlyTable,parseTmTimesOnly} from '../src/manualTmTimes.js';
import {readFile} from 'node:fs/promises';import vm from 'node:vm';
test('TM MatchStartTimes export uses scheduled epoch column and existing team identities only',()=>{
 const table=[['Match Number','Time Scheduled','Time Scheduled','Time Started'],['Q1','1791896400','2026-10-13 09:00:00','1791896500'],['Q2','1791896760','2026-10-13 09:06:00','']];assert.equal(isTmTimesOnlyTable(table),true);
 const result=parseTmTimesOnly(table,[{phase:'qual',num:1,red:['1A','2A'],blue:['3A','4A']}],{zone:'America/New_York'});assert.equal(result.rows.length,1);assert.equal(result.rows[0].scheduledAt,new Date(1791896400*1000).toISOString());assert.equal(result.unmatched,1);assert.deepEqual(result.rows[0].red,['1A','2A']);
});
test('times-only exports identify elimination replay games and reject duplicate labels',()=>{
 const table=[['Match Number','Time Scheduled'],['QF2-2','1791896400']];const result=parseTmTimesOnly(table,[{phase:'qf',num:1002,red:['1A'],blue:['2A']}]);assert.equal(result.rows[0].num,1002);assert.throws(()=>parseTmTimesOnly([...table,table[1]],[{phase:'qf',num:1002,red:['1A'],blue:['2A']}]),/Repeated/);
});
test('actual manual match parser reads CSV clocks and JSON TM timestamps',async()=>{
 const source=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8');const context={parseManualScheduledTime,tmScoreWinner:(a,b)=>a>b?'red':a<b?'blue':'tie'};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function parseCSV('),source.indexOf('const tmClean ='))+'\nthis.parse=parseMatchesFile;',context);
 const csv='Round,MatchNum,Red1,Red2,Blue1,Blue2,Date,Time\n2,1,1A,2A,3A,4A,10/13/2026,2:30 PM';const parsed=context.parse(csv,'matches.csv',{zone:'America/New_York'});assert.equal(parsed.rows[0].scheduledAt,'2026-10-13T18:30:00.000Z');assert.equal(parsed.rows[0].num,1);
 const noDate=context.parse(csv.replace(',Date,Time',',Time').replace(',10/13/2026,',','),'matches.csv',{zone:'America/New_York'});assert.equal(noDate.needsDate,true);
 const json=context.parse(JSON.stringify([{matchInfo:{timeScheduled:Date.parse('2026-10-13T18:30Z')/1000,matchTuple:{round:'QUAL',match:1},alliances:[{teams:[{number:'1A'}]},{teams:[{number:'2A'}]}]}}]),'matches.json');assert.equal(json.rows[0].scheduledAt,'2026-10-13T18:30:00.000Z');
});
test('manual schedule times support AM/PM, 24-hour, dates and Unix timestamps',()=>{
 const context={date:'2026-10-13',zone:'America/New_York'};assert.equal(parseManualScheduledTime('2:30 PM',context),'2026-10-13T18:30:00.000Z');assert.equal(parseManualScheduledTime('14:30',context),'2026-10-13T18:30:00.000Z');assert.equal(parseManualScheduledTime('10/13/2026 2:30 PM',{zone:context.zone}),'2026-10-13T18:30:00.000Z');assert.equal(parseManualScheduledTime('2026-10-13T18:30:00Z'), '2026-10-13T18:30:00.000Z');assert.equal(parseManualScheduledTime(Date.parse('2026-10-13T18:30:00Z')/1000), '2026-10-13T18:30:00.000Z');assert.equal(parseManualScheduledTime('12:00 AM',context),'2026-10-13T04:00:00.000Z');
});
test('missing dates, invalid clocks and daylight-saving gaps do not fabricate times',()=>{
 assert.throws(()=>parseManualScheduledTime('2:30 PM'),/date required/);assert.throws(()=>parseManualScheduledTime('25:00',{date:'2026-10-13'}),/Invalid scheduled/);assert.throws(()=>parseManualScheduledTime('09:00',{date:'2026-02-30'}),/Invalid schedule date/);assert.throws(()=>parseManualScheduledTime('02:30',{date:'2026-03-08',zone:'America/New_York'}),/does not exist/);assert.equal(parseManualScheduledTime(''),null);
});
test('partial imports retain unrelated times but clear stale team identities and invalid times',()=>{
 const old=[{phase:'qual',num:1,red:['1A'],blue:['2A'],scheduledAt:'old'},{phase:'qual',num:2,red:['3A'],blue:['4A'],scheduledAt:'keep'}];const updated=mergeManualMatchTimes(old,[{phase:'qual',num:1,red:['1A'],blue:['2A'],scheduledAt:'new'}]);assert.equal(updated[0].scheduledAt,'new');assert.equal(updated[1].scheduledAt,'keep');assert.equal(mergeManualMatchTimes(old,[{phase:'qual',num:1,red:['9A'],blue:['2A']}]).length,1);assert.equal(mergeManualMatchTimes(old,[{...old[0],scheduledAt:null,timeInvalid:true}]).length,1);
});
