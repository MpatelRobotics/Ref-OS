import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('referee profiles and attendance are private and do not confer membership',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema auth;create role anon;create role authenticated;
 create table auth.users(id uuid primary key);create table events(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$select current_setting('test.uid',true)::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('is_anonymous',current_setting('test.anon',true))$$;
 grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
 await db.exec(await readFile(new URL('../supabase/referee-portal.sql',import.meta.url),'utf8'));
 const a='22222222-2222-4222-8222-222222222222',b='33333333-3333-4333-8333-333333333333',e='44444444-4444-4444-8444-444444444444';
 await db.query('insert into auth.users values ($1),($2)',[a,b]);await db.query('insert into events values ($1)',[e]);
 await db.query("select set_config('test.uid',$1,false),set_config('test.anon','false',false)",[a]);await db.exec('set role authenticated');
 await db.query('insert into referee_profiles(user_id,full_name) values ($1,$2)',[a,'Alex Smith']);
 await db.query('insert into referee_event_plans values ($1,$2,$3)',[a,e,'going']);
 await assert.rejects(db.query('insert into referee_profiles(user_id,full_name) values ($1,$2)',[b,'Other']),/row-level security/);
 await db.query("select set_config('test.uid',$1,false)",[b]);
 assert.equal((await db.query('select * from referee_profiles')).rows.length,0);
 assert.equal((await db.query('select * from referee_event_plans')).rows.length,0);
 await db.query("select set_config('test.uid',$1,false),set_config('test.anon','true',false)",[a]);
 assert.equal((await db.query('select * from referee_profiles')).rows.length,0);
 await assert.rejects(db.query('insert into referee_event_plans values ($1,$2,$3)',[a,e,'attended']),/row-level security/);
 }finally{await db.close();}
});
