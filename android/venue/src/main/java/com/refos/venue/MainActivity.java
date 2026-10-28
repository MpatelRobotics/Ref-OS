package com.refos.venue;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.os.*;
import android.content.*;
import android.net.Uri;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.view.*;
import android.widget.*;
import java.util.*;
import java.io.*;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.common.BitMatrix;

public final class MainActivity extends Activity {
 private LinearLayout layout,addresses;private EditText port;private TextView status;private Button start,stop,open;private final Handler handler=new Handler(Looper.getMainLooper());private String last="";
 private TextView devices,readiness,backupStatus;private Spinner backupList;private Button backupNow,restore,export;private String backupSignature="",exportName;private File[] displayedBackups=new File[0];
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
  text("Ready for your event?",21);button("Check Readiness").setOnClickListener(v->VenueService.checkReadiness());readiness=text("",16);
  text("Connected devices",21);text("Active means this server heard from the device within 90 seconds. Last seen is its latest sync request.",16);devices=text("",16);
  text("Automatic backups",21);text("Saved every 5 minutes while running and before stopping. The latest 24 stay on this device. Export a copy to protect against loss or uninstalling the host app.",16);backupStatus=text("",16);
  backupNow=button("Back Up Now");backupNow.setOnClickListener(v->VenueService.backupNow());
  TextView backupLabel=text("Saved backup",16);backupList=new Spinner(this);backupList.setId(View.generateViewId());backupLabel.setLabelFor(backupList.getId());layout.addView(backupList);
  restore=button("Restore Selected Backup");restore.setOnClickListener(v->{File[] files=displayedBackups;int selected=backupList.getSelectedItemPosition();if(selected<0||selected>=files.length)return;String name=files[selected].getName();new AlertDialog.Builder(this).setTitle("Restore this backup?").setMessage("Stop the server first. Current records will be backed up before restoring. Newer changes stay in that backup.").setNegativeButton("Cancel",null).setPositiveButton("Restore",(d,w)->new Thread(()->{try{VenueBackups.restore(this,name);handler.post(()->Toast.makeText(this,"Backup restored. Tap Start Server when ready.",Toast.LENGTH_LONG).show());}catch(Exception e){handler.post(()->Toast.makeText(this,e.getMessage(),Toast.LENGTH_LONG).show());}}).start()).show();});
  export=button("Export Selected Backup");export.setOnClickListener(v->{File[] files=displayedBackups;int selected=backupList.getSelectedItemPosition();if(selected<0||selected>=files.length)return;exportName=files[selected].getName();startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/octet-stream").putExtra(Intent.EXTRA_TITLE,exportName),40);});
  text("Keep this device plugged in. Sharing continues with a notification until you tap Stop Server. Force-stopping the app or restarting Android stops sharing; reopen the app and tap Start Server.\n\nRecords stay on this device. Export Venue Data from Ref OS before switching to Cloud. Uninstalling this app deletes its local records.\n\nIf other devices cannot connect, ask venue IT whether Wi-Fi device isolation is enabled.",16);
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},1);
 }
 private void update(){boolean active=VenueService.running;status.setText(active?"Server running":VenueService.error.isEmpty()?"Server stopped":VenueService.error);start.setEnabled(!active&&!VenueBackups.restoring);stop.setEnabled(active);port.setEnabled(!active);open.setEnabled(active&&!VenueService.addresses().isEmpty());
  devices.setText(VenueService.deviceText);readiness.setText(VenueService.checks);File[] files=VenueBackups.list(this);backupNow.setEnabled(active);restore.setEnabled(!active&&!VenueBackups.restoring&&files.length>0);export.setEnabled(files.length>0);backupStatus.setText(!VenueService.backupError.isEmpty()?VenueService.backupError:files.length==0?"No backups yet. Start the server to save one.":"Latest backup: "+java.text.DateFormat.getDateTimeInstance().format(new Date(files[0].lastModified())));
  String signature=Arrays.toString(Arrays.stream(files).map(File::getName).toArray());if(!signature.equals(backupSignature)){backupSignature=signature;displayedBackups=files;List<String> labels=new ArrayList<>();for(File f:files)labels.add(java.text.DateFormat.getDateTimeInstance().format(new Date(f.lastModified())));backupList.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,labels));}
  String key=active+VenueService.addresses().toString();if(key.equals(last))return;last=key;addresses.removeAllViews();if(active){List<String> urls=VenueService.addresses();if(urls.isEmpty()){TextView t=new TextView(this);t.setText("No network address found. Connect to Wi-Fi and try again.");addresses.addView(t);}for(String url:urls){TextView t=new TextView(this);t.setText(url);t.setTextSize(18);t.setTextIsSelectable(true);t.setPadding(0,dp(12),0,dp(8));addresses.addView(t);Button b=new Button(this);b.setText("Copy Address");b.setAllCaps(false);b.setMinHeight(dp(48));b.setOnClickListener(v->{((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Venue address",url));Toast.makeText(this,"Address copied",Toast.LENGTH_SHORT).show();});addresses.addView(b);
   try{Bitmap bitmap=connectionQr(url);ImageView qr=new ImageView(this);qr.setImageBitmap(bitmap);qr.setContentDescription("Scan to open Ref OS at "+url);addresses.addView(qr,new LinearLayout.LayoutParams(dp(240),dp(240)));}catch(Exception ignored){}
  }}
 }
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==40&&result==RESULT_OK&&data!=null&&exportName!=null)new Thread(()->{try(InputStream in=new FileInputStream(VenueBackups.selected(this,exportName));OutputStream out=getContentResolver().openOutputStream(data.getData())){byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);handler.post(()->Toast.makeText(this,"Backup exported",Toast.LENGTH_SHORT).show());}catch(Exception e){handler.post(()->Toast.makeText(this,"Export failed: "+e.getMessage(),Toast.LENGTH_LONG).show());}}).start();}
 static Bitmap connectionQr(String url)throws Exception{BitMatrix matrix=new QRCodeWriter().encode(url,BarcodeFormat.QR_CODE,280,280);Bitmap bitmap=Bitmap.createBitmap(280,280,Bitmap.Config.ARGB_8888);for(int y=0;y<280;y++)for(int x=0;x<280;x++)bitmap.setPixel(x,y,matrix.get(x,y)?Color.BLACK:Color.WHITE);return bitmap;}
 @Override protected void onResume(){super.onResume();handler.post(refresh);}
 @Override protected void onPause(){handler.removeCallbacks(refresh);super.onPause();}
}
