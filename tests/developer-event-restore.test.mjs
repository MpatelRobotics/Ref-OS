import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('developer restoration preserves data and respects lockout and service-only access',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table events(id uuid,archived_at timestamptz,name text);
 create table event_access_attempts(event_id uuid,user_id uuid);
 create function refos_access_locked(uuid,uuid) returns boolean language sql as 'select exists(select 1 from event_access_attempts where event_id=$1 and user_id=$2)';`);
 await db.exec(await readFile(new URL('../supabase/developer-event-restore.sql',import.meta.url),'utf8'));
 const e='22222222-2222-4222-8222-222222222222',u='33333333-3333-4333-8333-333333333333';
 await db.query('insert into events values ($1,now(),$2)',[e,'Keep me']);
 await db.query('insert into event_access_attempts values ($1,$2)',[e,u]);
 assert.equal((await db.query('select restore_refos_event_as_developer($1,$2) result',[e,u])).rows[0].result,'locked');
 await db.exec('delete from event_access_attempts');
 assert.equal((await db.query('select restore_refos_event_as_developer($1,$2) result',[e,u])).rows[0].result,'restored');
 assert.deepEqual((await db.query('select name,archived_at from events')).rows,[{name:'Keep me',archived_at:null}]);
 assert.equal((await db.query('select restore_refos_event_as_developer($1,$2) result',[e,u])).rows[0].result,'active');
 await db.exec('set role authenticated');
 await assert.rejects(db.query('select restore_refos_event_as_developer($1,$2)',[e,u]),/permission denied/);
 }finally{await db.close();}
});
