package com.refos.venue;

import android.Manifest;
import android.app.Activity;
import android.os.*;
import android.content.*;
import android.net.Uri;
import android.graphics.Color;
import android.view.*;
import android.widget.*;
import java.util.*;

public final class MainActivity extends Activity {
 private LinearLayout layout,addresses;private EditText port;private TextView status;private Button start,stop,open;private final Handler handler=new Handler(Looper.getMainLooper());private String last="";
 private final Runnable refresh=new Runnable(){public void run(){update();handler.postDelayed(this,1500);}};
 private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density);}
 private TextView text(String value,int size){TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(Color.rgb(23,35,59));t.setPadding(0,dp(10),0,dp(10));layout.addView(t);return t;}
 private Button button(String label){Button b=new Button(this);b.setText(label);b.setAllCaps(false);b.setMinHeight(dp(52));layout.addView(b,new LinearLayout.LayoutParams(-1,-2));return b;}
 @Override public void onCreate(Bundle state){super.onCreate(state);
  ScrollView scroll=new ScrollView(this);layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setPadding(dp(22),dp(20),dp(22),dp(28));layout.setBackgroundColor(Color.rgb(243,245,250));scroll.addView(layout);setContentView(scroll);
  scroll.setOnApplyWindowInsetsListener((v,insets)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);}else v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
  text("Ref OS Venue Server",28);text("Host local event sharing on this Android device. Other devices connect through their browser.",16);
  status=text("Server stopped",21);status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
  TextView portLabel=text("Server port",16);port=new EditText(this);port.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);port.setText("8080");port.setId(View.generateViewId());portLabel.setLabelFor(port.getId());layout.addView(port);
  start=button("Start Server");start.setOnClickListener(v->{try{int chosen=Integer.parseInt(port.getText().toString());if(chosen<1024||chosen>65535)throw new IllegalArgumentException();Intent intent=new Intent(this,VenueService.class).putExtra("port",chosen);startForegroundService(intent);}catch(Exception e){status.setText("Enter a port between 1024 and 65535.");}});
  stop=button("Stop Server");stop.setOnClickListener(v->stopService(new Intent(this,VenueService.class)));
  text("Connect your devices",21);text("1. Connect every device to the same Wi-Fi.\n\n2. Enter an address below in Server URL in Ref OS, then tap Open Ref OS at the venue address. You can also type it directly into the other device's browser.\n\n3. Sign in while internet is available, then test a sample violation on two devices.",16);
  addresses=new LinearLayout(this);addresses.setOrientation(LinearLayout.VERTICAL);layout.addView(addresses);
  open=button("Open Ref OS on this device");open.setOnClickListener(v->{List<String> urls=VenueService.addresses();if(!urls.isEmpty())startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(urls.get(0))));});
  text("Keep this device plugged in. Sharing continues with a notification until you tap Stop Server. Force-stopping the app or restarting Android stops sharing; reopen the app and tap Start Server.\n\nRecords stay on this device. Export Venue Data from Ref OS before switching to Cloud. Uninstalling this app deletes its local records.\n\nIf other devices cannot connect, ask venue IT whether Wi-Fi device isolation is enabled.",16);
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},1);
 }
 private void update(){boolean active=VenueService.running;status.setText(active?"Server running":VenueService.error.isEmpty()?"Server stopped":VenueService.error);start.setEnabled(!active);stop.setEnabled(active);port.setEnabled(!active);open.setEnabled(active&&!VenueService.addresses().isEmpty());String key=active+VenueService.addresses().toString();if(key.equals(last))return;last=key;addresses.removeAllViews();if(active){List<String> urls=VenueService.addresses();if(urls.isEmpty()){TextView t=new TextView(this);t.setText("No network address found. Connect to Wi-Fi and try again.");addresses.addView(t);}for(String url:urls){TextView t=new TextView(this);t.setText(url);t.setTextSize(18);t.setTextIsSelectable(true);t.setPadding(0,dp(12),0,dp(8));addresses.addView(t);Button b=new Button(this);b.setText("Copy Address");b.setAllCaps(false);b.setMinHeight(dp(48));b.setOnClickListener(v->{((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Venue address",url));Toast.makeText(this,"Address copied",Toast.LENGTH_SHORT).show();});addresses.addView(b);}}}
 @Override protected void onResume(){super.onResume();handler.post(refresh);}
 @Override protected void onPause(){handler.removeCallbacks(refresh);super.onPause();}
}
