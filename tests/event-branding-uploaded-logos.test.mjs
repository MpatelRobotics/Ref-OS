import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {resolveEventBranding} from '../src/eventProfiles.js';

test('public branding returns uploaded logos with URL precedence and excludes other settings',async()=>{
 const db=new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create table events(id uuid,name text,created_at timestamptz); create table event_settings(event_id uuid,key text,value jsonb);');
  await db.exec(await readFile(new URL('../supabase/event-branding-uploaded-logos.sql',import.meta.url),'utf8'));
  const id='22222222-2222-4222-8222-222222222222';
  const logo='data:image/png;base64,AAAA';
  await db.query('insert into events values ($1,$2,now())',[id,'Event']);
  await db.query('insert into event_settings values ($1,$2,$3)',[id,'event_branding',JSON.stringify({logoData:logo,shortName:'Test',secret:'private'})]);
  let result=await db.query('select * from list_refos_event_branding()');
  assert.equal(result.rows[0].logo_url,logo);
  assert.equal(resolveEventBranding(id,{name:'Event'},{logoData:result.rows[0].logo_url}).logo,logo);
  assert.equal('secret' in result.rows[0],false);
  await db.query("update event_settings set value=value || $1::jsonb",[JSON.stringify({logoUrl:'https://example.org/logo.png'})]);
  result=await db.query('select * from list_refos_event_branding()');
  assert.equal(result.rows[0].logo_url,'https://example.org/logo.png');
 } finally {await db.close();}
});
