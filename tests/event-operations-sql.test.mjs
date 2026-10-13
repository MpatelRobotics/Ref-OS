import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const event='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222';
test('operations migration enforces roles, division/session scopes, version conflicts and interview buffers',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql as $$select '33333333-3333-4333-8333-333333333333'::uuid$$;create function public.has_event_role(p_event uuid,p_roles text[]) returns boolean language sql as $$select current_setting('test.role')=any(p_roles)$$;
 create table events(id uuid primary key);create table league_sessions(id uuid primary key,event_id uuid);create table teams(event_id uuid,number text);create table event_settings(event_id uuid,key text,value jsonb);create table judging_interview_schedules(event_id uuid,value jsonb);
 insert into events values('${event}');insert into league_sessions values('${session}','${event}');insert into teams values('${event}','1A');insert into event_settings values('${event}','vex_divisions','{"divisions":[{"id":1,"name":"A"},{"id":2,"name":"B"}]}');set test.role='admin';`);
 await db.exec(await readFile(new URL('../supabase/event-operations.sql',import.meta.url),'utf8'));
 const save=(kind,payload,division=1,id=null,version=0)=>db.query('select * from public.save_event_operation($1,$2,$3,$4,$5,$6,$7)',[event,session,division,kind,JSON.stringify(payload),id,version]);
 const first=(await save('announcement',{note:'Hello A',owner:'',status:'open'})).rows[0];assert.equal(first.division_id,1);
 await assert.rejects(save('announcement',{note:'Invalid division',status:'open'},9),/Invalid division/);
 await assert.rejects(save('announcement',{note:'Changed',status:'open'},2,first.id,0),/Record changed/);
 const moved=(await save('announcement',{note:'Hello B',status:'open'},2,first.id,1)).rows[0];assert.equal(moved.division_id,2);
 await db.exec("set test.role='inspection'");await assert.rejects(save('judge-group',{team:'1A',note:'Secret',owner:'Panel',status:'open'}),/Event access/);
 await save('inspection-followup',{team:'1A',note:'Check modification',owner:'Inspector',status:'open'});
 await db.exec("set test.role='judge'");await save('judge-group',{team:'1A',note:'Assigned',owner:'Panel 1',status:'open'});await assert.rejects(save('announcement',{note:'No',status:'open'}),/Event access/);
 await db.exec("set test.role='admin'");await save('attendance',{team:'1A',status:'present'},0);await assert.rejects(save('attendance',{team:'1A',status:'absent'},0),/duplicate key/);
 await db.exec("grant usage on schema auth to authenticated;set role authenticated;set test.role='inspection'");
 assert.equal((await db.query("select * from event_operations where kind='judge-group'")).rows.length,0);
 await assert.rejects(db.query("insert into event_operations(event_id,kind,payload) values($1,'announcement','{}')",[event]),/permission denied/);
 await db.exec('reset role');
 const value={entries:[{id:'a',team:'1A',start:'2026-10-13T12:00:00Z',minutes:10,buffer:5,panel:'Panel 1',status:'scheduled'},{id:'b',team:'2A',start:'2026-10-13T12:12:00Z',minutes:10,panel:'Panel 1'}]};await assert.rejects(db.query('insert into judging_interview_schedules values($1,$2)',[event,JSON.stringify(value)]),/buffer overlaps/);
 }finally{await db.close();}
});
