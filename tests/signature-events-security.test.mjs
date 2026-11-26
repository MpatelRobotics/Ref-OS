import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('database protects signature writes and exposes only visible event status',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql as $$select null::uuid$$;
 create function public.refos_is_developer(uuid) returns boolean language sql as $$select coalesce(current_setting('test.developer',true),'false')::boolean$$;
 create table event_settings(event_id uuid,key text,value jsonb);
 create function list_refos_events() returns table(event_id uuid) language sql as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;`);
 await db.exec(await readFile(new URL('../supabase/signature-events.sql',import.meta.url),'utf8'));
 const id='11111111-1111-4111-8111-111111111111';
 await assert.rejects(db.query(`insert into event_settings values($1,'signature_event','{"enabled":true}')`,[id]),/Developer access required/);
 await db.exec(`set test.developer='true'`);
 await db.query(`insert into event_settings values($1,'signature_event','{"enabled":true}')`,[id]);
 assert.equal((await db.query('select * from list_refos_signature_events()')).rows[0].enabled,true);
 await db.exec(`set test.developer='false'`);
 await assert.rejects(db.exec(`update event_settings set value='{"enabled":false}'`),/Developer access required/);
 await assert.rejects(db.exec(`delete from event_settings`),/Developer access required/);
 await db.exec(`set test.developer='true'; update event_settings set value='{"enabled":false}'`);
 assert.equal((await db.query('select * from list_refos_signature_events()')).rows[0].enabled,false);
 } finally {await db.close();}
});
