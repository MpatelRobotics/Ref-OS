package com.refos.venue;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import org.json.*;

/** Event-scoped, durable change log. The wire format matches the Windows venue server. */
final class VenueStore implements AutoCloseable {
 private final SQLiteDatabase db;
 VenueStore(Context context){
  db=context.openOrCreateDatabase("refos-venue.sqlite",0,null);db.enableWriteAheadLogging();
  db.execSQL("PRAGMA synchronous=FULL");
  db.execSQL("CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,key_hash TEXT NOT NULL)");
  db.execSQL("CREATE TABLE IF NOT EXISTS records(event TEXT,kind TEXT,id TEXT,data TEXT,deleted INTEGER,version INTEGER,updated INTEGER,device TEXT,PRIMARY KEY(event,kind,id))");
  db.execSQL("CREATE TABLE IF NOT EXISTS changes(seq INTEGER PRIMARY KEY AUTOINCREMENT,event TEXT,change_id TEXT,kind TEXT,id TEXT,op TEXT,data TEXT,version INTEGER,status TEXT,device TEXT,ts INTEGER,UNIQUE(event,change_id))");
  db.execSQL("CREATE INDEX IF NOT EXISTS event_seq ON changes(event,seq)");
  db.execSQL("CREATE TABLE IF NOT EXISTS devices(event TEXT,id TEXT,label TEXT,seen INTEGER,PRIMARY KEY(event,id))");
 }
 synchronized String key(String event){try(Cursor c=db.rawQuery("SELECT key_hash FROM events WHERE id=?",new String[]{event})){return c.moveToFirst()?c.getString(0):null;}}
 synchronized void register(String event,String hash){db.execSQL("INSERT INTO events VALUES(?,?)",new Object[]{event,hash});}
 synchronized long latest(String event){try(Cursor c=db.rawQuery("SELECT COALESCE(MAX(seq),0) FROM changes WHERE event=?",new String[]{event})){c.moveToFirst();return c.getLong(0);}}
 synchronized void touch(String event,String id,String label){db.execSQL("INSERT OR REPLACE INTO devices VALUES(?,?,?,?)",new Object[]{event,id,label,System.currentTimeMillis()});}
 synchronized JSONArray apply(String event,String device,JSONArray list) throws Exception {
  JSONArray result=new JSONArray();db.beginTransaction();
  try{for(int i=0;i<list.length();i++){
   JSONObject v=list.getJSONObject(i);String change=v.getString("changeId"),kind=v.getString("kind"),id=v.getString("recordId"),op=v.getString("op");
   try(Cursor c=db.rawQuery("SELECT seq,version FROM changes WHERE event=? AND change_id=?",new String[]{event,change})){if(c.moveToFirst()){result.put(new JSONObject().put("changeId",change).put("status","duplicate").put("seq",c.getLong(0)).put("version",c.getInt(1)));continue;}}
   int version=0;boolean deleted=false;String current=null;
   try(Cursor c=db.rawQuery("SELECT data,deleted,version FROM records WHERE event=? AND kind=? AND id=?",new String[]{event,kind,id})){if(c.moveToFirst()){current=c.getString(0);deleted=c.getInt(1)!=0;version=c.getInt(2);}}
   String data=op.equals("upsert")?v.getJSONObject("data").toString():null,status="applied";
   if(op.equals("upsert")){if(deleted)status="rejected_deleted";else if(data.equals(current))status="unchanged";else if(version>0&&v.has("baseVersion")&&!v.isNull("baseVersion")&&v.getInt("baseVersion")<version)status="applied_conflict";}
   else if(deleted)status="unchanged";
   long now=System.currentTimeMillis();
   if(status.startsWith("applied")){version++;db.execSQL("INSERT OR REPLACE INTO records VALUES(?,?,?,?,?,?,?,?)",new Object[]{event,kind,id,op.equals("upsert")?data:current==null?"{}":current,op.equals("delete")?1:0,version,now,device});}
   db.execSQL("INSERT INTO changes(event,change_id,kind,id,op,data,version,status,device,ts) VALUES(?,?,?,?,?,?,?,?,?,?)",new Object[]{event,change,kind,id,op,data,version,status,device,now});
   long seq;try(Cursor c=db.rawQuery("SELECT last_insert_rowid()",null)){c.moveToFirst();seq=c.getLong(0);}
   result.put(new JSONObject().put("changeId",change).put("status",status).put("version",version).put("seq",seq));
  }db.setTransactionSuccessful();return result;}finally{db.endTransaction();}
 }
 synchronized JSONArray since(String event,long since,int limit)throws Exception{
  JSONArray rows=new JSONArray();try(Cursor c=db.rawQuery("SELECT seq,change_id,kind,id,op,data,version,device,ts FROM changes WHERE event=? AND seq>? AND status IN ('applied','applied_conflict') ORDER BY seq LIMIT ?",new String[]{event,""+since,""+limit})){while(c.moveToNext())rows.put(new JSONObject().put("seq",c.getLong(0)).put("changeId",c.getString(1)).put("kind",c.getString(2)).put("recordId",c.getString(3)).put("op",c.getString(4)).put("data",c.isNull(5)?JSONObject.NULL:new JSONObject(c.getString(5))).put("version",c.getInt(6)).put("deviceId",c.getString(7)).put("serverTs",c.getLong(8)));}return rows;
 }
 synchronized JSONObject counts(String event)throws Exception{
  JSONObject byKind=new JSONObject();try(Cursor c=db.rawQuery("SELECT kind,COUNT(*) FROM records WHERE event=? AND deleted=0 GROUP BY kind",new String[]{event})){while(c.moveToNext())byKind.put(c.getString(0),c.getInt(1));}
  try(Cursor c=db.rawQuery("SELECT COUNT(*) FROM changes WHERE event=?",new String[]{event})){c.moveToFirst();return new JSONObject().put("records",byKind).put("changes",c.getInt(0));}
 }
 synchronized JSONArray devices(String event)throws Exception{JSONArray rows=new JSONArray();try(Cursor c=db.rawQuery("SELECT id,label,seen FROM devices WHERE event=?",new String[]{event})){while(c.moveToNext())rows.put(new JSONObject().put("deviceId",c.getString(0)).put("label",c.getString(1)).put("lastSeen",VenueHttp.iso(c.getLong(2))));}return rows;}
 synchronized JSONObject export(String event)throws Exception{
  JSONObject out=new JSONObject().put("format","refos-venue-export").put("formatVersion",1).put("serverVersion","2.0.0-android").put("eventId",event).put("exportedAt",VenueHttp.iso(System.currentTimeMillis())).put("reconciledToCloud",false).put("counts",counts(event)).put("latestSeq",latest(event)).put("devices",devices(event));
  JSONArray violations=new JSONArray(),logs=new JSONArray(),roster=new JSONArray();out.put("violations",violations).put("fieldLog",logs).put("roster",roster);
  try(Cursor c=db.rawQuery("SELECT kind,id,data,deleted,version,updated,device FROM records WHERE event=?",new String[]{event})){while(c.moveToNext()){JSONArray bucket=c.getString(0).equals("violation")?violations:c.getString(0).equals("field_log")?logs:c.getString(0).equals("roster")?roster:null;if(bucket!=null)bucket.put(new JSONObject().put("id",c.getString(1)).put("data",new JSONObject(c.getString(2))).put("deleted",c.getInt(3)!=0).put("version",c.getInt(4)).put("updatedAt",VenueHttp.iso(c.getLong(5))).put("updatedByDevice",c.getString(6)));}}return out;
 }
 public synchronized void close(){db.close();}
}
