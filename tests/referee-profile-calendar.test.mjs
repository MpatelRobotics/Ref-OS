import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('profile program and language lists persist privately; public dates contain only event identity and dates',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);create table events(id uuid primary key);create table event_settings(event_id uuid,key text,value jsonb);create table referee_external_events(code text);
 create function auth.uid() returns uuid language sql as $$select current_setting('test.uid',true)::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('is_anonymous','false')$$;
 grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
 await db.exec(await readFile(new URL('../supabase/referee-portal.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/referee-profile-calendar.sql',import.meta.url),'utf8'));
 const a='22222222-2222-4222-8222-222222222222',b='33333333-3333-4333-8333-333333333333';
 await db.query('insert into auth.users values ($1),($2)',[a,b]);await db.query('insert into events values ($1)',[a]);
 await db.query("insert into event_settings values ($1,'vex_event',$2)",[a,JSON.stringify({start:'2026-11-01',end:'2026-11-02',secret:'private'})]);
 await db.query("select set_config('test.uid',$1,false)",[a]);await db.exec('set role authenticated');
 await db.query("insert into referee_profiles(user_id,full_name,programs,languages) values ($1,'Alex',array['V5RC','VURC'],array['English','Swahili'])",[a]);
 assert.deepEqual((await db.query('select programs,languages from referee_profiles')).rows,[{programs:['V5RC','VURC'],languages:['English','Swahili']}]);
 await assert.rejects(db.query("update referee_profiles set programs=array['admin']"),/check constraint/);
 await db.query("select set_config('test.uid',$1,false)",[b]);
 assert.equal((await db.query('select * from referee_profiles')).rows.length,0);
 assert.deepEqual((await db.query('select * from list_referee_event_dates()')).rows,[{event_id:a,start_date:'2026-11-01',end_date:'2026-11-02'}]);
 }finally{await db.close();}
});
