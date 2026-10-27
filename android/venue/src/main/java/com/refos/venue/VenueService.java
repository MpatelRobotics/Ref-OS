package com.refos.venue;

import android.app.*;
import android.content.*;
import android.os.*;
import java.net.*;
import java.util.*;

public final class VenueService extends Service {
 static volatile boolean running=false;static volatile String error="";static volatile int port=8080;
 private VenueHttp server;private PowerManager.WakeLock wake;
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
   if(port<1024||port>65535)throw new IllegalArgumentException("Enter a port between 1024 and 65535.");
   server=new VenueHttp(this,port);server.start(15000,false);
   wake=((PowerManager)getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"RefOS:VenueServer");wake.acquire();running=true;
  }catch(Exception e){error=e instanceof java.net.BindException?"This port is already in use. Try 8081.":"Could not start server: "+e.getMessage();stopSelf();}
  return START_NOT_STICKY;
 }
 @Override public void onDestroy(){running=false;if(server!=null){server.stop();server=null;}if(wake!=null&&wake.isHeld())wake.release();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
}
