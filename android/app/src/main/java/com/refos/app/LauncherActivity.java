package com.refos.app;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.widget.*;
import android.view.WindowInsets;
import android.os.Build;

/** Native-only launcher: web pages cannot start or stop hosting. */
public final class LauncherActivity extends Activity {
 @Override public void onCreate(Bundle state){super.onCreate(state);
  LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);
  int pad=(int)(24*getResources().getDisplayMetrics().density);layout.setPadding(pad,pad,pad,pad);
  ScrollView scroll=new ScrollView(this);scroll.addView(layout);setContentView(scroll);
  scroll.setOnApplyWindowInsetsListener((v,insets)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);}else v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
  TextView heading=new TextView(this);heading.setText("Ref-OS Connect");heading.setTextSize(28);layout.addView(heading);
  TextView intro=new TextView(this);intro.setText("Choose a tool. Connect this device to your event Wi-Fi.\n\nTM Connect reads Tournament Manager data. Venue Server hosts local sharing for your crew. Both tools are included in this app.");intro.setTextSize(17);intro.setPadding(0,pad,0,pad);layout.addView(intro);
  Button tm=new Button(this);tm.setText("Open Ref-OS / TM Connect");tm.setAllCaps(false);tm.setMinHeight(56);layout.addView(tm);tm.setOnClickListener(v->startActivity(new Intent(this,MainActivity.class)));
  Button venue=new Button(this);venue.setText("Manage Venue Server");venue.setAllCaps(false);venue.setMinHeight(56);layout.addView(venue);venue.setOnClickListener(v->startActivity(new Intent(this,com.refos.venue.MainActivity.class)));
  TextView note=new TextView(this);note.setText("Use Android Back to return here. Venue hosting continues with a notification until you tap Stop Server. Keep this device plugged in.\n\nIf you used the separate Venue Server app, export its backup before uninstalling it. This app keeps separate local records; existing records are not moved automatically.");note.setTextSize(16);note.setPadding(0,pad,0,pad);layout.addView(note);
 }
}
