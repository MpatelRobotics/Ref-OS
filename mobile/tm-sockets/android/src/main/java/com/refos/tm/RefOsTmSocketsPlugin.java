package com.refos.tm;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.Iterator;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import okhttp3.*;

@CapacitorPlugin(name = "RefOsTmSockets")
public class RefOsTmSocketsPlugin extends Plugin {
    private volatile boolean foreground = true;
    private final ConcurrentHashMap<String, WebSocket> sockets = new ConcurrentHashMap<>();
    private final OkHttpClient client = new OkHttpClient.Builder()
        .followRedirects(false).followSslRedirects(false)
        .connectTimeout(15, TimeUnit.SECONDS).pingInterval(25, TimeUnit.SECONDS).build();

    private void emit(String id, String type, String data) {
        JSObject event = new JSObject();
        event.put("id", id); event.put("type", type);
        if (data != null) event.put("data", data);
        notifyListeners("socketEvent", event);
    }

    @PluginMethod public void sign(PluginCall call) {
        try {
            String key = call.getString("key"), message = call.getString("message");
            if (key == null || key.isEmpty() || key.length() > 2000 || message == null || message.length() > 20000) throw new IllegalArgumentException();
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            StringBuilder hex = new StringBuilder();
            for (byte value : mac.doFinal(message.getBytes(StandardCharsets.UTF_8))) hex.append(String.format("%02x", value & 255));
            JSObject result = new JSObject(); result.put("signature", hex.toString()); call.resolve(result);
        } catch (Exception error) { call.reject("Could not sign the TM request."); }
    }

    @PluginMethod public void open(PluginCall call) {
        String id = call.getString("id"), address = call.getString("url");
        try {
            if (!foreground) throw new IllegalStateException();
            URI uri = new URI(address);
            if (id == null || id.length() > 100 || uri.getHost() == null || uri.getUserInfo() != null
                || !("ws".equals(uri.getScheme()) || "wss".equals(uri.getScheme()))
                || !uri.getPath().matches("/api/fieldsets/[1-9][0-9]*") || uri.getQuery() != null)
                throw new IllegalArgumentException();
            WebSocket previous = sockets.remove(id);
            if (previous != null) previous.cancel();
            Request.Builder request = new Request.Builder().url(address);
            JSObject headers = call.getObject("headers", new JSObject());
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                if (!key.equalsIgnoreCase("Authorization") && !key.equalsIgnoreCase("x-tm-date") && !key.equalsIgnoreCase("x-tm-signature"))
                    throw new IllegalArgumentException();
                request.header(key, headers.getString(key));
            }
            synchronized (sockets) {
            WebSocket socket = client.newWebSocket(request.build(), new WebSocketListener() {
                @Override public void onOpen(WebSocket ws, Response response) { synchronized (sockets) { if (sockets.get(id) == ws) emit(id, "open", null); } }
                @Override public void onMessage(WebSocket ws, String text) {
                    if (sockets.get(id) != ws) return;
                    if (text.length() > 65536) { ws.cancel(); return; }
                    emit(id, "message", text);
                }
                @Override public void onFailure(WebSocket ws, Throwable error, Response response) {
                    if (sockets.remove(id, ws)) emit(id, "error", null);
                }
                @Override public void onClosing(WebSocket ws, int code, String reason) { ws.close(code, null); }
                @Override public void onClosed(WebSocket ws, int code, String reason) {
                    if (sockets.remove(id, ws)) emit(id, "close", null);
                }
            });
            sockets.put(id, socket);
            }
            call.resolve();
        } catch (Exception error) { call.reject("Could not open the TM live field connection."); }
    }
    @PluginMethod public void closeAll(PluginCall call) { closeSockets(); call.resolve(); }
    private void closeSockets() {
        synchronized (sockets) {
            WebSocket[] previous = sockets.values().toArray(new WebSocket[0]); sockets.clear();
            for (WebSocket socket : previous) socket.cancel();
        }
    }
    @Override protected void handleOnPause() {
        foreground = false;
        String[] ids = sockets.keySet().toArray(new String[0]); closeSockets();
        for (String id : ids) emit(id, "close", null);
    }
    @Override protected void handleOnResume() { foreground = true; }
    @Override protected void handleOnDestroy() { closeSockets(); client.dispatcher().executorService().shutdown(); }
}
