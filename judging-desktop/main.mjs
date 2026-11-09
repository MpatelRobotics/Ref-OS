import {app,BrowserWindow,shell,Menu} from 'electron';
import {fileURLToPath} from 'node:url';
const official='https://www.ref-os.fyi/?app=judging';
const testUrl=process.env.REFOS_JUDGING_TEST_URL;
const start=!app.isPackaged&&testUrl&&/^http:\/\/127\.0\.0\.1:\d+\//.test(testUrl)?testUrl:official;
const origin=new URL(start).origin;
let window;
app.setName('Ref-OS Judging Portal');
app.setAppUserModelId('RefOSJudgingPortal');
const external=async url=>{try{const parsed=new URL(url);if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)await shell.openExternal(parsed.href);}catch{}};
app.whenReady().then(async()=>{
 Menu.setApplicationMenu(null);
 window=new BrowserWindow({show:process.env.REFOS_JUDGING_TEST!=='1',title:'Ref-OS Judging Portal',width:1360,height:900,minWidth:600,minHeight:500,icon:fileURLToPath(new URL('./icon.png',import.meta.url)),backgroundColor:'#f1f5f9',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 window.webContents.setWindowOpenHandler(({url})=>{void external(url);return {action:'deny'};});
 window.webContents.on('will-attach-webview',event=>event.preventDefault());
 window.webContents.on('will-navigate',(event,url)=>{
  const next=new URL(url);
  if(next.origin!==origin||next.searchParams.get('app')!=='judging') {event.preventDefault();void external(url);}
 });
 window.webContents.on('page-title-updated',event=>{event.preventDefault();window.setTitle('Ref-OS Judging Portal');});
 try{await window.loadURL(start);}catch{
  const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Ref-OS Judging Portal</title><body style="font:20px system-ui;background:#f1f5f9;color:#0f172a;padding:48px"><h1>Ref-OS Judging Portal</h1><p>Could not reach Ref-OS. Check your internet connection, then try again.</p><a href="${official}">Try again</a></body></html>`;
  await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
 }
});
app.on('window-all-closed',()=>app.quit());
