package com.refos.venue;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import java.io.*;
import java.nio.file.*;
import java.util.*;

final class VenueBackups {
 static volatile boolean restoring=false;
 static File directory(Context c){return new File(c.getFilesDir(),"venue-backups");}
 static File[] list(Context c){File[] files=directory(c).listFiles(f->f.isFile()&&f.getName().matches("venue-[0-9]{13}-[a-f0-9]{8}\\.sqlite"));if(files==null)return new File[0];Arrays.sort(files,(a,b)->Long.compare(b.lastModified(),a.lastModified()));return files;}
 static void copySnapshot(Context c)throws IOException{
  File dir=directory(c);if(!dir.exists()&&!dir.mkdirs())throw new IOException("Cannot create backup folder.");
  String name="venue-"+System.currentTimeMillis()+"-"+UUID.randomUUID().toString().substring(0,8)+".sqlite";
  File temp=new File(dir,name+".partial"),target=new File(dir,name);
  Files.copy(c.getDatabasePath("refos-venue.sqlite").toPath(),temp.toPath(),StandardCopyOption.REPLACE_EXISTING);
  try(RandomAccessFile file=new RandomAccessFile(temp,"rw")){file.getFD().sync();}
  Files.move(temp.toPath(),target.toPath(),StandardCopyOption.REPLACE_EXISTING);
  File[] old=list(c);for(int i=24;i<old.length;i++)Files.delete(old[i].toPath());
 }
 static File selected(Context c,String name)throws IOException{
  for(File file:list(c))if(file.getName().equals(name)&&file.getCanonicalFile().getParentFile().equals(directory(c).getCanonicalFile()))return file;
  throw new IOException("Choose a saved venue backup.");
 }
 static synchronized void restore(Context c,String name)throws Exception{
  restoring=true;try{restoreStopped(c,name);}finally{restoring=false;}
 }
 private static void restoreStopped(Context c,String name)throws Exception{
  if(VenueService.running)throw new IOException("Stop the server before restoring.");
  File source=selected(c,name);
  try(SQLiteDatabase db=SQLiteDatabase.openDatabase(source.getPath(),null,SQLiteDatabase.OPEN_READONLY)){
   try(Cursor check=db.rawQuery("PRAGMA quick_check",null)){if(!check.moveToFirst()||!"ok".equals(check.getString(0)))throw new IOException("Backup integrity check failed.");}
   try(Cursor ignored=db.rawQuery("SELECT id FROM events LIMIT 1",null)){ignored.moveToFirst();}
  }
  File database=c.getDatabasePath("refos-venue.sqlite"),temp=new File(c.getFilesDir(),"restore-pending.sqlite");Files.copy(source.toPath(),temp.toPath(),StandardCopyOption.REPLACE_EXISTING);
  if(database.exists()){try(VenueStore store=new VenueStore(c)){store.backup(c);}}
  Files.deleteIfExists(new File(database.getPath()+"-wal").toPath());Files.deleteIfExists(new File(database.getPath()+"-shm").toPath());
  Files.move(temp.toPath(),database.toPath(),StandardCopyOption.REPLACE_EXISTING);
 }
}
