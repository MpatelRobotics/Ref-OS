import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('bulk logout requires developer, preserves caller and records, and preserves all admins and developers',async()=>{
 const db=new PGlite();
 const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',admin='cccccccc-cccc-4ccc-8ccc-cccccccccccc',volunteer='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 await db.exec(`
 create role anon;create role authenticated;create role service_role;
 create table event_members(user_id uuid,event_id int,role text,developer boolean);
 create table developer_passkey_challenges(user_id uuid);
 create table user_live_activity(user_id uuid);
 create table teams(number text);
 insert into teams values('123A');
 insert into event_members values('${actor}',1,'admin',true),('${other}',1,'admin',true),('${other}',2,'ref',false),('${admin}',2,'admin',false),('${volunteer}',1,'ref',false),('${volunteer}',2,'inspection',false);
 insert into developer_passkey_challenges values('${actor}'),('${other}'),('${volunteer}');
 insert into user_live_activity values('${actor}'),('${other}'),('${volunteer}');
 `);
 await db.exec(readFileSync(new URL('../supabase/developer-signout-all.sql',import.meta.url),'utf8'));
 await assert.rejects(db.query('select revoke_all_refos_device_access($1)',[admin]));
 const result=(await db.query('select revoke_all_refos_device_access($1) as r',[actor])).rows[0].r;
 assert.deepEqual(result,{devices:1,memberships:2});
 assert.equal((await db.query('select * from event_members')).rows.length,4);
 assert.equal((await db.query('select * from teams')).rows.length,1);
 assert.equal((await db.query('select * from user_live_activity')).rows.length,2);
 await db.exec('set role authenticated');
 await assert.rejects(db.query('select revoke_all_refos_device_access($1)',[actor]));
 await db.close();
});
