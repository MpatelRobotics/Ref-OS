package com.refos.venue;

import android.content.Context;
import fi.iki.elonen.NanoHTTPD;
import org.json.*;
import org.mozilla.javascript.Scriptable;
import java.io.*;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.regex.*;

final class VenueHttp extends NanoHTTPD {
 private final Context context;final VenueStore store;private final String validation;
 private final Map<String,long[]> failures=new HashMap<>();
 VenueHttp(Context c,int port)throws Exception{super("0.0.0.0",port);context=c;store=new VenueStore(c);try(InputStream in=c.getAssets().open("validation.js")){validation=new String(read(in,200000),StandardCharsets.UTF_8);}catch(Exception e){store.close();throw e;}}
 static String iso(long ts){SimpleDateFormat f=new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.US);f.setTimeZone(TimeZone.getTimeZone("UTC"));return f.format(new Date(ts));}
 static byte[] read(InputStream in,int max)throws IOException{ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1){if(out.size()+n>max)throw new IOException("Request too large");out.write(buf,0,n);}return out.toByteArray();}
 static String hash(String key)throws Exception{byte[] bytes=MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format("%02x",b&255));return s.toString();}
 private Response json(int status,JSONObject body){Response r=newFixedLengthResponse(Response.Status.lookup(status),"application/json",body.toString());r.addHeader("Cache-Control","no-store");r.addHeader("X-Content-Type-Options","nosniff");return r;}
 private Response error(int code,String message){try{return json(code,new JSONObject().put("error",message));}catch(Exception e){throw new RuntimeException(e);}}
 private synchronized boolean blocked(String ip){long[] f=failures.get(ip);return f!=null&&System.currentTimeMillis()-f[0]<300000&&f[1]>=20;}
 private synchronized void fail(String ip){if(failures.size()>5000)failures.clear();long now=System.currentTimeMillis();long[] f=failures.get(ip);if(f==null||now-f[0]>=300000)failures.put(ip,new long[]{now,1});else f[1]++;}
 private JSONObject validate(Object raw)throws Exception{
  org.mozilla.javascript.Context cx=org.mozilla.javascript.Context.enter();
  try{cx.setOptimizationLevel(-1);cx.setLanguageVersion(org.mozilla.javascript.Context.VERSION_ES6);cx.setClassShutter(name->false);Scriptable scope=cx.initSafeStandardObjects();cx.evaluateString(scope,validation,"validation",1,null);String expr="JSON.stringify(VenueValidation.validateChange(JSON.parse("+JSONObject.quote(String.valueOf(raw))+")))";return new JSONObject(org.mozilla.javascript.Context.toString(cx.evaluateString(scope,expr,"change",1,null)));}finally{org.mozilla.javascript.Context.exit();}
 }
 @Override public Response serve(IHTTPSession s){
  String origin=s.getHeaders().get("origin"),host=s.getHeaders().get("host");
  if(origin!=null&&!origin.equals("http://"+host))return error(403,"Origin not allowed");
  Response r;
  try{r=route(s);}catch(Exception e){r=error(400,"Invalid request: "+(e.getMessage()==null?"could not read request":e.getMessage()));}
  if(origin!=null){r.addHeader("Access-Control-Allow-Origin",origin);r.addHeader("Vary","Origin");r.addHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");r.addHeader("Access-Control-Allow-Headers","Authorization, Content-Type, X-Refos-Device, X-Refos-Device-Label");}
  return r;
 }
 private synchronized Response route(IHTTPSession s)throws Exception{
  String path=s.getUri(),ip=s.getRemoteIpAddress();Method method=s.getMethod();
  String requestBody="{}";
  if(method==Method.POST){
   long length;try{length=Long.parseLong(s.getHeaders().getOrDefault("content-length","-1"));}catch(Exception e){length=-1;}
   if(length<0||length>8*1024*1024||s.getHeaders().containsKey("transfer-encoding"))return error(413,"A request body of at most 8 MB is required.");
   Map<String,String> parsed=new HashMap<>();s.parseBody(parsed);requestBody=parsed.getOrDefault("postData","{}");
  }
  if(method==Method.OPTIONS)return newFixedLengthResponse(Response.Status.NO_CONTENT,"text/plain","");
  if(path.equals("/api/v1/health")&&method==Method.GET)return json(200,new JSONObject().put("service","refos-venue-server").put("version","2.0.0-android").put("apiVersion",1).put("status","ok").put("serverTime",iso(System.currentTimeMillis())));
  if(!path.startsWith("/api/"))return staticFile(path,method);
  Matcher m=Pattern.compile("^/api/v1/events/([0-9a-fA-F-]+)/(register|changes|status|export)$").matcher(path);
  if(!m.matches())return error(404,"Not found");String event=m.group(1).toLowerCase(Locale.US),action=m.group(2);
  if(!event.matches("[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"))return error(400,"Invalid event id");
  if(blocked(ip))return error(429,"Too many failed attempts. Try again later.");
  String auth=s.getHeaders().getOrDefault("authorization","");Matcher token=Pattern.compile("^Bearer ([0-9a-f]{64})$",Pattern.CASE_INSENSITIVE).matcher(auth);
  if(!token.matches()){fail(ip);return error(401,"Missing venue sync key.");}String key=hash(token.group(1).toLowerCase(Locale.US)),existing=store.key(event);
  String device=s.getHeaders().getOrDefault("x-refos-device","");if(!device.matches("[A-Za-z0-9._:@-]{1,128}"))device="";
  if(action.equals("register")&&method==Method.POST){if(existing==null){store.register(event,key);return json(200,new JSONObject().put("paired",true).put("created",true).put("latestSeq",0));}if(!MessageDigest.isEqual(key.getBytes(StandardCharsets.UTF_8),existing.getBytes(StandardCharsets.UTF_8))){fail(ip);return error(409,"This event is paired with a different venue sync key.");}return json(200,new JSONObject().put("paired",true).put("created",false).put("latestSeq",store.latest(event)));}
  if(existing==null||!MessageDigest.isEqual(key.getBytes(StandardCharsets.UTF_8),existing.getBytes(StandardCharsets.UTF_8))){fail(ip);return error(401,"Not authorized for this event.");}
  if(!device.isEmpty()){String label=URLDecoder.decode(s.getHeaders().getOrDefault("x-refos-device-label",""),"UTF-8");store.touch(event,device,label.substring(0,Math.min(80,label.length())));}
  if(action.equals("changes")&&method==Method.GET){long since=number(s,"since",0);int limit=(int)Math.min(1000,Math.max(1,number(s,"limit",500)));JSONArray changes=store.since(event,Math.max(0,since),limit);long latest=store.latest(event),next=changes.length()>0?changes.getJSONObject(changes.length()-1).getLong("seq"):latest;return json(200,new JSONObject().put("changes",changes).put("latestSeq",latest).put("nextSince",next).put("hasMore",changes.length()==limit).put("serverTime",iso(System.currentTimeMillis())));}
  if(action.equals("changes")&&method==Method.POST){
   if(device.isEmpty())return error(400,"X-Refos-Device header required");
   JSONObject data=new JSONObject(requestBody);JSONArray list=data.optJSONArray("changes");if(list==null||list.length()==0)return error(400,"changes[] required");if(list.length()>200)return error(413,"Too many changes in one request");
   JSONArray valid=new JSONArray(),invalid=new JSONArray();for(int i=0;i<list.length();i++){JSONObject checked=validate(list.get(i));if(checked.has("error")){JSONObject raw=list.optJSONObject(i);invalid.put(new JSONObject().put("changeId",raw==null?JSONObject.NULL:raw.opt("changeId")).put("status","invalid").put("error",checked.getString("error")));}else valid.put(checked.getJSONObject("change"));}
   JSONArray results=store.apply(event,device,valid);for(int i=0;i<invalid.length();i++)results.put(invalid.get(i));return json(200,new JSONObject().put("results",results).put("latestSeq",store.latest(event)));
  }
  if(action.equals("status")&&method==Method.GET)return json(200,new JSONObject().put("eventId",event).put("latestSeq",store.latest(event)).put("counts",store.counts(event)).put("devices",store.devices(event).length()).put("serverTime",iso(System.currentTimeMillis())));
  if(action.equals("export")&&method==Method.GET){Response r=json(200,store.export(event));r.addHeader("Content-Disposition","attachment; filename=\"refos-venue-"+event+".json\"");return r;}
  return error(405,"Method not allowed");
 }
 private long number(IHTTPSession s,String name,long fallback){try{return Long.parseLong(s.getParms().getOrDefault(name,""+fallback));}catch(Exception e){return fallback;}}
 private Response staticFile(String path,Method method)throws Exception{
  if(method!=Method.GET&&method!=Method.HEAD)return error(405,"Method not allowed");
  if(path.contains("..")||path.contains("\\")||path.indexOf(0)>=0)return error(403,"Forbidden");
  String file=path.equals("/")?"index.html":path.substring(1);InputStream in;
  try{in=context.getAssets().open("public/"+file);}catch(IOException e){if(file.contains("."))return error(404,"Not found");file="index.html";in=context.getAssets().open("public/index.html");}
  String type=file.endsWith(".html")?"text/html":file.endsWith(".js")?"text/javascript":file.endsWith(".css")?"text/css":file.endsWith(".json")?"application/json":file.endsWith(".png")?"image/png":file.endsWith(".svg")?"image/svg+xml":file.endsWith(".pdf")?"application/pdf":"application/octet-stream";
  Response r=newChunkedResponse(Response.Status.OK,type,in);r.addHeader("Cache-Control",file.equals("index.html")||file.equals("sw.js")?"no-cache":"public, max-age=3600");r.addHeader("X-Content-Type-Options","nosniff");return r;
 }
 @Override public synchronized void stop(){super.stop();store.close();}
}
