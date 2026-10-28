import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
test('private test events are atomic, developer-only, absent from every public listing and guarded through RLS',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create table public.events(id uuid primary key default gen_random_uuid(),name text,created_at timestamptz default now(),archived_at timestamptz,event_format text default 'tournament');
 create table public.event_members(event_id uuid references events(id) on delete cascade,user_id uuid,role text,developer boolean default false,primary key(event_id,user_id));
 create table public.event_access_credentials(event_id uuid,credential_name text);
 create table public.refos_storage_purge_queue(purged_event_id uuid primary key,requested_at timestamptz default now());
 create function public.archive_refos_event(p_event uuid) returns timestamptz language plpgsql security definer as $$begin update events set archived_at=now() where id=p_event;return now();end$$;
 create table public.teams(event_id uuid references events(id) on delete cascade,number text,name text,primary key(event_id,number));
 alter table events enable row level security;alter table event_members enable row level security;alter table teams enable row level security;
 create policy baseline on events for all using(true) with check(true);create policy baseline on event_members for all using(true) with check(true);create policy baseline on teams for all using(true) with check(true);
 grant select,insert,update,delete on events,event_members,teams to anon,authenticated;
 create function public.create_refos_vex_event_with_format(p_name text,p_admin_credential text,p_format text) returns setof events language plpgsql security definer as $$ declare e events%rowtype;begin
 if length(p_name)<3 or p_admin_credential !~ '^[0-9][A-Z][0-9][0-9]$' then raise exception 'Invalid input';end if;
 insert into events(name,event_format) values(p_name,p_format) returning * into e;insert into event_members values(e.id,auth.uid(),'admin',false);insert into event_access_credentials values(e.id,'admin_keypad');return next e;end $$;
 create function list_refos_events() returns table(event_id uuid,event_name text) language sql security definer as $$select id,name from events$$;
 create function list_refos_event_branding() returns table(event_id uuid,event_name text,short_name text) language sql security definer as $$select id,name,'' from events$$;
 create function list_refos_event_lifecycle() returns table(event_id uuid,archived_at timestamptz,created_at timestamptz) language sql security definer as $$select id,archived_at,created_at from events$$;
 create function list_refos_event_formats() returns table(event_id uuid,event_format text) language sql security definer as $$select id,event_format from events$$;
 create function list_refos_event_locations() returns table(event_id uuid,location text,state text) language sql security definer as $$select id,'','' from events$$;
 insert into events(id,name) values('11111111-1111-4111-8111-111111111111','Public Event');
 insert into event_members values('11111111-1111-4111-8111-111111111111','${actor}','admin',true),('11111111-1111-4111-8111-111111111111','${other}','admin',false);
 `);
 const migration=readFileSync(new URL('../supabase/developer-test-events.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${other}'`);
 await assert.rejects(db.query("select * from create_developer_test_event('Hidden','tournament',true)"),/Developer access/);
 await db.exec(`set request.jwt.claim.sub='${actor}'`);
 await assert.rejects(db.query("select * from create_developer_test_event('Hi','tournament',true)"));
 const hidden=(await db.query("select * from create_developer_test_event('Hidden','tournament',true)")).rows[0];
 assert.equal((await db.query('select * from teams where event_id=$1',[hidden.id])).rows.length,32);
 assert.equal((await db.query('select * from list_developer_test_events()')).rows.length,1);
 await db.exec('reset role');assert.equal((await db.query('select * from event_access_credentials where event_id=$1',[hidden.id])).rows.length,0);
 await db.query("insert into event_access_credentials values($1,'legacy_admin')",[hidden.id]);await db.exec(migration);assert.equal((await db.query('select * from event_access_credentials where event_id=$1',[hidden.id])).rows.length,0);assert.equal((await db.query("select to_regprocedure('public.create_developer_test_event(text,text,text,boolean)') as f")).rows[0].f,null);await db.exec("set role authenticated");
 await db.exec(`reset role;alter table event_members disable trigger guard_developer_test_membership`);
 await db.query("insert into event_members values($1,$2,'admin',false)",[hidden.id,other]);
 await db.exec(`alter table event_members enable trigger guard_developer_test_membership;set role authenticated;set request.jwt.claim.sub='${other}'`);
 assert.equal((await db.query('select * from events where id=$1',[hidden.id])).rows.length,0);
 assert.equal((await db.query('select * from teams where event_id=$1',[hidden.id])).rows.length,0);
 await assert.rejects(db.query('select * from list_developer_test_events()'),/Developer access/);
 await assert.rejects(db.query('select open_developer_test_event($1)',[hidden.id]),/Developer access/);
 await assert.rejects(db.query('select delete_developer_test_event($1,$2)',[hidden.id,'Hidden']),/Developer access/);
 assert.equal((await db.query("update event_members set role='admin' where event_id=$1 returning *",[hidden.id])).rows.length,0);
 await db.exec(`reset role;create function attempt_private_join(p_event uuid) returns void language plpgsql security definer as $$begin insert into event_members values(p_event,auth.uid(),'admin',false) on conflict(event_id,user_id) do update set role='admin';end$$;set role authenticated`);
 await assert.rejects(db.query('select attempt_private_join($1)',[hidden.id]),/only to developers/);
 for(const role of ['authenticated','anon']){
  await db.exec(`reset role;set role ${role}`);
  for(const fn of ['list_refos_events','list_refos_event_branding','list_refos_event_lifecycle','list_refos_event_formats','list_refos_event_locations']){
   assert.deepEqual((await db.query(`select event_id from ${fn}()`)).rows.map(r=>r.event_id),['11111111-1111-4111-8111-111111111111']);
   await assert.rejects(db.query(`select * from ${fn}_public_base()`),/permission denied/);
  }
 }
 await db.exec("reset role;set role authenticated;set request.jwt.claim.sub='"+actor+"'");
 await assert.rejects(db.query('select delete_developer_test_event($1,$2)',['11111111-1111-4111-8111-111111111111','Public Event']),/not found/);
 await assert.rejects(db.query('select delete_developer_test_event($1,$2)',[hidden.id,'Wrong name']),/name changed/);
 await db.query('select delete_developer_test_event($1,$2)',[hidden.id,'Hidden']);
 await db.exec('reset role');assert.equal((await db.query('select * from events where id=$1',[hidden.id])).rows.length,0);assert.equal((await db.query('select * from teams where event_id=$1',[hidden.id])).rows.length,0);assert.equal((await db.query('select * from developer_test_events')).rows.length,0);assert.equal((await db.query('select * from refos_storage_purge_queue where purged_event_id=$1',[hidden.id])).rows.length,1);assert.equal((await db.query('select * from events')).rows.length,1);
 }finally{await db.close();}
});
