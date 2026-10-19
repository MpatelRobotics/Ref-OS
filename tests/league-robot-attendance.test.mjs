import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('league attendance allows inspection crew within their event and denies read-only roles',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role authenticated;create table league_session_attendance(event_id uuid,session_id uuid,team text,status text,primary key(event_id,session_id,team));alter table league_session_attendance enable row level security;grant all on league_session_attendance to authenticated;
 create function has_event_role(p_event uuid,p_roles text[]) returns boolean language sql as $$select p_event::text=current_setting('test.event',true) and current_setting('test.role',true)=any(p_roles)$$;
 create policy members_read on league_session_attendance for select to authenticated using(has_event_role(event_id,array['ref','admin','inspection','judge','emcee']));`);
 await db.exec(await readFile(new URL('../supabase/league-robot-attendance.sql',import.meta.url),'utf8'));
 const event='22222222-2222-4222-8222-222222222222',session='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444';
 await db.query("select set_config('test.event',$1,false),set_config('test.role','inspection',false)",[event]);await db.exec('set role authenticated');
 await db.query("insert into league_session_attendance values ($1,$2,'37S','present')",[event,session]);
 await db.query("update league_session_attendance set status='absent' where team='37S'");assert.equal((await db.query('select status from league_session_attendance')).rows[0].status,'absent');
 await assert.rejects(db.query("insert into league_session_attendance values ($1,$2,'37S','present')",[other,session]),/row-level security/);
 await db.query("select set_config('test.role','emcee',false)");
 await assert.rejects(db.query("insert into league_session_attendance values ($1,$2,'99A','present')",[event,session]),/row-level security/);
 await db.exec('delete from league_session_attendance');assert.equal((await db.query('select * from league_session_attendance')).rows.length,1);
 await db.query("select set_config('test.role','inspection',false)");await db.exec('delete from league_session_attendance');assert.equal((await db.query('select * from league_session_attendance')).rows.length,0);
 }finally{await db.close();}
});
