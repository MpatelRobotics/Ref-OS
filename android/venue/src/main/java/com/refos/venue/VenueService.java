package com.refos.venue;

import android.app.*;
import android.content.*;
import android.os.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

public final class VenueService extends Service {
 static volatile boolean running=false;static volatile String error="";static volatile int port=8080;
 private VenueHttp server;private PowerManager.WakeLock wake;
 private ScheduledExecutorService worker;
 private static VenueService instance;
 static volatile String deviceText="No devices have synced yet.",checks="Tap Check Readiness after connecting two devices.",backupError="";
 static void backupNow(){VenueService current=instance;if(current!=null&&current.worker!=null)current.worker.execute(current::backup);}
 private void backup(){try{if(server!=null)server.store.backup(this);backupError="";}catch(Exception e){backupError="Backup failed: "+e.getMessage();}}
 private void updateDevices(){try{if(server==null)return;JSONArray devices=server.store.hostDevices();StringBuilder text=new StringBuilder();long now=System.currentTimeMillis();for(int i=0;i<devices.length();i++){JSONObject d=devices.getJSONObject(i);String name=d.optString("name","");text.append(name.isEmpty()?"Unnamed device":name).append(now-d.getLong("seen")<90000?" · Active":" · Offline").append("\nLast seen ").append(java.text.DateFormat.getTimeInstance().format(new Date(d.getLong("seen")))).append(" · Event ").append(d.getString("event").substring(0,8)).append("\n\n");}deviceText=text.length()==0?"No devices have signed in and synced yet.":text.toString();}catch(Exception e){deviceText="Could not load devices.";}}
 static void checkReadiness(){VenueService current=instance;if(current==null||current.worker==null){checks="Start the server first.";return;}checks="Checking...";current.worker.execute(()->{
  try{boolean healthy=false;HttpURLConnection connection=(HttpURLConnection)new URL("http://127.0.0.1:"+port+"/api/v1/health").openConnection();try{connection.setConnectTimeout(3000);connection.setReadTimeout(3000);healthy=connection.getResponseCode()==200;}finally{connection.disconnect();}
   Map<String,Integer> acknowledged=new HashMap<>();JSONArray devices=current.server.store.hostDevices();for(int i=0;i<devices.length();i++){JSONObject d=devices.getJSONObject(i);if(System.currentTimeMillis()-d.getLong("seen")<90000&&d.getLong("lastSeq")>0)acknowledged.put(d.getString("event"),acknowledged.getOrDefault(d.getString("event"),0)+1);}
   checks=(healthy?"Passed: Server responds":"Needs attention: Server is not responding")+"\n\n"+(!addresses().isEmpty()?"Passed: Network address available":"Needs attention: Connect host to Wi-Fi")+"\n\n"+(current.server.store.eventCount()>0?"Passed: Event signed in and paired":"Needs attention: Open Ref OS at the venue address and sign in")+"\n\n"+(acknowledged.values().stream().anyMatch(n->n>=2)?"Passed: Two devices received shared data":"Needs attention: Connect two devices to the same event, add a sample violation and wait for both to sync")+"\n\n"+(backupError.isEmpty()&&VenueBackups.list(current).length>0?"Passed: Automatic backup saved":"Needs attention: "+backupError)+"\n\nSharing checks use device sync acknowledgments; they cannot test every Wi-Fi route.";
  }catch(Exception e){checks="Check could not finish: "+e.getMessage();}
 });}
 static List<String> addresses(){List<String> out=new ArrayList<>();try{Enumeration<NetworkInterface> interfaces=NetworkInterface.getNetworkInterfaces();while(interfaces.hasMoreElements()){NetworkInterface n=interfaces.nextElement();if(!n.isUp()||n.isLoopback())continue;Enumeration<InetAddress> addrs=n.getInetAddresses();while(addrs.hasMoreElements()){InetAddress a=addrs.nextElement();if(a instanceof Inet4Address&&!a.isLoopbackAddress()&&!a.isLinkLocalAddress())out.add("http://"+a.getHostAddress()+":"+port);}}}catch(Exception ignored){}return out;}
 @Override public IBinder onBind(Intent intent){return null;}
 @Override public int onStartCommand(Intent intent,int flags,int startId){
  if(intent!=null&&"stop".equals(intent.getAction())){stopSelf();return START_NOT_STICKY;}
  if(running)return START_NOT_STICKY;
  error="";port=intent==null?8080:intent.getIntExtra("port",8080);
  try{
   NotificationManager manager=getSystemService(NotificationManager.class);manager.createNotificationChannel(new NotificationChannel("venue","Venue sharing",NotificationManager.IMPORTANCE_LOW));
   PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
   PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,VenueService.class).setAction("stop"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
   Notification notification=new Notification.Builder(this,"venue").setSmallIcon(android.R.drawable.stat_notify_sync).setContentTitle("Ref OS venue server is running").setContentText("Devices on your Wi-Fi can share event updates. Tap to view addresses.").setContentIntent(open).setOngoing(true).addAction(new Notification.Action.Builder(null,"Stop Server",stop).build()).build();
   startForeground(42,notification);
   if(VenueBackups.restoring)throw new IllegalStateException("Wait for the backup restore to finish.");
   if(port<1024||port>65535)throw new IllegalArgumentException("Enter a port between 1024 and 65535.");
   server=new VenueHttp(this,port);server.start(15000,false);
   wake=((PowerManager)getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"RefOS:VenueServer");wake.acquire();running=true;instance=this;
   worker=Executors.newSingleThreadScheduledExecutor();worker.execute(this::backup);worker.scheduleAtFixedRate(this::backup,5,5,TimeUnit.MINUTES);worker.scheduleAtFixedRate(this::updateDevices,0,3,TimeUnit.SECONDS);
  }catch(Exception e){error=e instanceof java.net.BindException?"This port is already in use. Try 8081.":"Could not start server: "+e.getMessage();stopSelf();}
  return START_NOT_STICKY;
 }
 @Override public void onDestroy(){instance=null;running=false;if(worker!=null){worker.shutdown();try{worker.awaitTermination(4,TimeUnit.SECONDS);}catch(InterruptedException ignored){Thread.currentThread().interrupt();}worker.shutdownNow();}if(server!=null){backup();server.stop();server=null;}checks="Tap Check Readiness after connecting two devices.";deviceText="Server stopped.";if(wake!=null&&wake.isHeld())wake.release();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
}
