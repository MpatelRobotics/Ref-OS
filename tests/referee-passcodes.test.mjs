import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('personal passcodes are private, scoped, replaceable and rate limited; portal can create an event without Admin codes',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema auth;create schema extensions;create role anon;create role authenticated;
 create table auth.users(id uuid primary key);
 create table events(id uuid primary key default gen_random_uuid(),name text,join_code text,created_by uuid,created_at timestamptz default now(),archived_at timestamptz);
 create table event_settings(event_id uuid,key text,value jsonb,primary key(event_id,key));
 create table event_members(event_id uuid,user_id uuid,role text,name text,primary key(event_id,user_id));
 create table event_access_attempts(event_id uuid,user_id uuid,failed_count int,window_started timestamptz,locked_until timestamptz,primary key(event_id,user_id));
 create function auth.uid() returns uuid language sql as $$select current_setting('test.uid',true)::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('is_anonymous',current_setting('test.anon',true))$$;
 -- Crypto shims only for the lightweight database test; production uses pgcrypto.
 create function extensions.digest(text,text) returns bytea language sql as $$select convert_to(md5($1),'UTF8')$$;
 create function extensions.gen_salt(text,int) returns text language sql as $$select 'test-salt'::text$$;
 create function extensions.crypt(text,text) returns text language sql as $$select md5($1)$$;
 grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
 await db.exec(await readFile(new URL('../supabase/referee-portal.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/referee-portal-passcodes.sql',import.meta.url),'utf8'));
 const a='22222222-2222-4222-8222-222222222222',b='33333333-3333-4333-8333-333333333333',e='44444444-4444-4444-8444-444444444444',other='55555555-5555-4555-8555-555555555555';
 await db.query('insert into auth.users values ($1),($2)',[a,b]);
 await db.query('insert into events(id,name) values ($1,$2),($3,$4)',[e,'Event',other,'Other event']);
 await db.query("select set_config('test.uid',$1,false),set_config('test.anon','false',false)",[a]);await db.exec('set role authenticated');
 await db.query('select set_referee_passcode($1)',['ABC12345']);
 await assert.rejects(db.query('select * from referee_passcodes'),/permission denied/);
 await db.query('insert into referee_event_plans values ($1,$2,$3)',[a,e,'going']);
 await db.query('insert into referee_profiles(user_id,full_name) values ($1,$2)',[a,'Alex Smith']);
 // Signed-in portal opens without any event Admin credential, and preserves existing role.
 assert.equal((await db.query('select claim_referee_passcode($1,null) result',[e])).rows[0].result,'ok');
 await db.exec('reset role');await db.query("update event_members set role='admin' where user_id=$1",[a]);await db.exec('set role authenticated');
 await db.query('select claim_referee_passcode($1,null)',[e]);
 await db.exec('reset role');assert.equal((await db.query('select role from event_members where user_id=$1',[a])).rows[0].role,'admin');await db.exec('set role authenticated');
 await db.query('insert into referee_external_events(user_id,code,name,attendance) values ($1,$2,$3,$4)',[a,'VE-V5-27-65868','New VEX event','going']);
 const opened=(await db.query('select open_referee_external_event($1) id',['VE-V5-27-65868'])).rows[0].id;
 assert.equal((await db.query('select open_referee_external_event($1) id',['VE-V5-27-65868'])).rows[0].id,opened);
 await db.exec('reset role');assert.equal((await db.query('select role from event_members where event_id=$1',[opened])).rows[0].role,'ref');await db.exec('set role authenticated');
 // Another device can use the code only for the owner's selected event.
 await db.query("select set_config('test.uid',$1,false),set_config('test.anon','true',false)",[b]);
 assert.equal((await db.query('select claim_referee_passcode($1,$2) result',[e,'ABC12345'])).rows[0].result,'ok');
 assert.equal((await db.query('select claim_referee_passcode($1,$2) result',[other,'ABC12345'])).rows[0].result,'invalid');
 await assert.rejects(db.query('select set_referee_passcode($1)',['ABC67890']),/Sign in/);
 for(let i=0;i<7;i++)await db.query('select claim_referee_passcode($1,$2)',[other,'BAD00000']);
 assert.equal((await db.query('select claim_referee_passcode($1,$2) result',[other,'ABC12345'])).rows[0].result,'locked');
 await db.query("select set_config('test.uid',$1,false),set_config('test.anon','false',false)",[a]);
 await db.query('select set_referee_passcode($1)',['NEW12345']);
 await db.query("select set_config('test.uid',$1,false),set_config('test.anon','true',false)",[b]);
 assert.equal((await db.query('select claim_referee_passcode($1,$2) result',[e,'ABC12345'])).rows[0].result,'invalid');
 assert.equal((await db.query('select claim_referee_passcode($1,$2) result',[e,'NEW12345'])).rows[0].result,'ok');
 await db.exec('reset role');await db.query('update events set archived_at=now() where id=$1',[e]);await db.exec('set role authenticated');
 assert.equal((await db.query('select claim_referee_passcode($1,$2) result',[e,'NEW12345'])).rows[0].result,'archived');
 }finally{await db.close();}
});
