package com.refos.venue;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Robolectric;
import org.robolectric.android.controller.ServiceController;
import android.content.Intent;
import org.robolectric.annotation.Config;
import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=34)
public class VenueHostTest {
 private VenueHttp host;private int port;private final String event="11111111-1111-4111-8111-111111111111",key="a".repeat(64);
 private JSONObject request(String path,String method,String token,JSONObject body,int expected)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL("http://127.0.0.1:"+port+path).openConnection();c.setRequestMethod(method);c.setConnectTimeout(5000);c.setReadTimeout(5000);c.setRequestProperty("Authorization","Bearer "+token);c.setRequestProperty("X-Refos-Device","device-1");
  if(body!=null){byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);c.setRequestProperty("Content-Type","application/json");c.setDoOutput(true);c.setFixedLengthStreamingMode(bytes.length);try(OutputStream out=c.getOutputStream()){out.write(bytes);}}
  int actual=c.getResponseCode();try(InputStream in=actual>=400?c.getErrorStream():c.getInputStream()){JSONObject response=new JSONObject(new String(VenueHttp.read(in,100000),StandardCharsets.UTF_8));assertEquals(response.toString(),expected,actual);return response;}finally{c.disconnect();}
 }
 private String path(String suffix){return "/api/v1/events/"+event+"/"+suffix;}
 @Before public void start()throws Exception{RuntimeEnvironment.getApplication().deleteDatabase("refos-venue.sqlite");host=new VenueHttp(RuntimeEnvironment.getApplication(),0);host.start();port=host.getListeningPort();}
 @After public void stop(){if(host!=null)host.stop();}
 @Test public void sharesValidatedChangesAndSurvivesRestart()throws Exception{
  assertEquals("refos-venue-server",request("/api/v1/health","GET",key,null,200).getString("service"));
  request(path("register"),"POST",key,new JSONObject(),200);
  request(path("changes"),"GET","b".repeat(64),null,401);
  JSONObject change=new JSONObject().put("changeId","one").put("recordId","test-record").put("kind","violation").put("op","upsert").put("data",new JSONObject().put("team","123A").put("type","Minor").put("created_at","2026-10-27T12:00:00Z"));
  JSONObject body=new JSONObject().put("changes",new JSONArray().put(change));
  assertEquals("applied",request(path("changes"),"POST",key,body,200).getJSONArray("results").getJSONObject(0).getString("status"));
  assertEquals("duplicate",request(path("changes"),"POST",key,body,200).getJSONArray("results").getJSONObject(0).getString("status"));
  assertEquals(1,request(path("changes?since=0"),"GET",key,null,200).getJSONArray("changes").length());
  change.put("changeId","bad").getJSONObject("data").put("admin_password","not allowed");
  assertEquals("invalid",request(path("changes"),"POST",key,body,200).getJSONArray("results").getJSONObject(0).getString("status"));
  host.stop();host=new VenueHttp(RuntimeEnvironment.getApplication(),0);host.start();port=host.getListeningPort();
  assertEquals(1,request(path("export"),"GET",key,null,200).getJSONArray("violations").length());
 }
 @Test public void deletesAreNotResurrectedAndOtherEventsCannotReadRecords()throws Exception{
  request(path("register"),"POST",key,new JSONObject(),200);
  JSONObject change=new JSONObject().put("changeId","delete-one").put("recordId","gone").put("kind","roster").put("op","delete");
  JSONObject body=new JSONObject().put("changes",new JSONArray().put(change));
  assertEquals("applied",request(path("changes"),"POST",key,body,200).getJSONArray("results").getJSONObject(0).getString("status"));
  change.put("changeId","resurrect").put("op","upsert").put("data",new JSONObject().put("name","Example Ref"));
  assertEquals("rejected_deleted",request(path("changes"),"POST",key,body,200).getJSONArray("results").getJSONObject(0).getString("status"));
  request("/api/v1/events/22222222-2222-4222-8222-222222222222/export","GET",key,null,401);
 }
 @Test public void foregroundServiceStartsAndStopsWithPersistentNotification()throws Exception{
  ServiceController<VenueService> controller=Robolectric.buildService(VenueService.class).create();
  try{
   int freePort;try(ServerSocket socket=new ServerSocket(0)){freePort=socket.getLocalPort();}
   controller.get().onStartCommand(new Intent(RuntimeEnvironment.getApplication(),VenueService.class).putExtra("port",freePort),0,1);
   assertTrue(VenueService.error,VenueService.running);
   int original=port;port=freePort;
   assertEquals("ok",request("/api/v1/health","GET",key,null,200).getString("status"));port=original;
  }finally{controller.destroy();assertFalse(VenueService.running);}
 }
}
