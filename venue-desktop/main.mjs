import {app, BrowserWindow, ipcMain, shell, clipboard, dialog, powerSaveBlocker} from 'electron';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {networkInterfaces, tmpdir} from 'node:os';
import {mkdtempSync} from 'node:fs';
import {backups,makeBackup,restoreBackup,hostDevices,readiness} from './hostTools.mjs';
import QRCode from './qr.cjs';
const here=dirname(fileURLToPath(import.meta.url));
const resources=app.isPackaged?process.resourcesPath:join(here,'resources');
let win, host, sleepBlock, busy=false, quitting=false;
let backupTimer,backupError='',lastCheck=[],qrCache=new Map();
if(process.env.REFOS_VENUE_DESKTOP_TEST==='1')app.setPath('userData',mkdtempSync(join(tmpdir(),'refos-venue-desktop-')));
const single=app.requestSingleInstanceLock();
if(!single)app.quit();
const addresses=port=>Object.values(networkInterfaces()).flat().filter(a=>a.family==='IPv4'&&!a.internal).map(a=>'http://'+a.address+':'+port);
const dataDir=()=>join(app.getPath('userData'),'venue-data');
const state=()=>({running:!!host,addresses:host?addresses(host.server.address().port):[],local:host?'http://localhost:'+host.server.address().port:'',data:dataDir(),devices:hostDevices(host?.store),backups:backups(dataDir()),backupError,checks:lastCheck});
function backup(){try{if(host)makeBackup(host.store,dataDir());backupError='';}catch(e){backupError='Backup failed: '+e.message;}}
function trusted(e){return e.sender===win?.webContents&&e.senderFrame===win.webContents.mainFrame&&e.senderFrame.url===pathToFileURL(join(here,'index.html')).href;}
async function stop(){if(!host)return;clearInterval(backupTimer);backup();const old=host;host=null;lastCheck=[];await new Promise(resolve=>{old.server.close(resolve);old.server.closeAllConnections();});old.store.close();if(sleepBlock!==undefined){powerSaveBlocker.stop(sleepBlock);sleepBlock=undefined;}}
ipcMain.handle('venue:action',async(e,action,value)=>{
 if(!trusted(e))throw Error('Open the venue server window to use this control.');
 if(busy)throw Error('Please wait for the current action to finish.');
 busy=true;
 try{
  if(action==='start'&&!host){
   const port=Number(value);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Enter a port between 1024 and 65535.');
   const {createVenueServer}=await import(pathToFileURL(join(resources,'venue-server/server.mjs')).href);
   const next=createVenueServer({port,host:'0.0.0.0',dataDir:state().data,webRoot:join(resources,'dist'),allowedOrigins:[],maxChangesPerRequest:200,maxBodyBytes:8*1024*1024,quiet:true});
   try{await new Promise((resolve,reject)=>{next.server.once('error',reject);next.server.listen(port,'0.0.0.0',resolve);});}catch(error){next.store.close();throw Error(error.code==='EADDRINUSE'?'This port is already in use. Close the other venue server or try port 8081.':error.code==='EACCES'?'Windows blocked this port. Try port 8081 or ask venue IT for help.':error.message);}
   host=next;sleepBlock=powerSaveBlocker.start('prevent-app-suspension');backup();backupTimer=setInterval(backup,5*60*1000);lastCheck=[];
  }else if(action==='stop')await stop();
  else if(action==='copy'){if(!state().addresses.includes(value))throw Error('Choose a listed venue address.');clipboard.writeText(value);}
  else if(action==='open'){if(!host)throw Error('Start the server first.');await shell.openExternal(state().local);}
  else if(action==='qr'){if(!state().addresses.includes(value))throw Error('Choose a listed venue address.');if(!qrCache.has(value))qrCache.set(value,await QRCode.toDataURL(value,{width:240,margin:4,errorCorrectionLevel:'M'}));return {qr:qrCache.get(value)};}
  else if(action==='check'){
   let healthy=false;if(host)try{const response=await fetch(state().local+'/api/v1/health',{signal:AbortSignal.timeout(3000)});healthy=(await response.json()).service==='refos-venue-server';}catch{}
   const s=state();lastCheck=readiness({health:healthy,addresses:s.addresses,devices:s.devices,events:host?.store.listEvents().length||0,backupError:backupError||(!s.backups.length?'No backup saved yet. Start the server and try again.':'')});
  }
  else if(action==='backup'){if(!host)throw Error('Start the server first.');backup();if(backupError)throw Error(backupError);}
  else if(action==='restore'){
   if(host)throw Error('Stop the server before restoring a backup.');
   if(!backups(dataDir()).some(b=>b.name===value))throw Error('Choose a saved backup.');
   if(dialog.showMessageBoxSync(win,{type:'warning',buttons:['Cancel','Restore backup'],defaultId:0,cancelId:0,message:'Restore this venue backup?',detail:'Current records will be backed up first. Newer changes remain in that backup. Start the server after restoring.'})===1){restoreBackup(dataDir(),value);lastCheck=[];}
  }
  else if(action==='backup-folder'){await shell.openPath(join(dataDir(),'backups'));}
  else if(action!=='state')throw Error('Unknown action.');
  return state();
 }finally{busy=false;}
});
if(single){
 app.on('second-instance',()=>{win?.show();win?.focus();});
 app.whenReady().then(async()=>{
 win=new BrowserWindow({width:720,height:760,minWidth:480,minHeight:540,title:'Ref OS Venue Server',autoHideMenuBar:true,webPreferences:{preload:join(here,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',e=>e.preventDefault());
 await win.loadFile(join(here,'index.html'));
 win.on('close',e=>{if(host&&!quitting){e.preventDefault();const choice=dialog.showMessageBoxSync(win,{type:'question',buttons:['Keep server running','Stop server and exit'],defaultId:0,cancelId:0,message:'Stop local sharing?',detail:'Other devices will stop receiving venue updates until you start the server again. Saved event data stays on this computer.'});if(choice===1){quitting=true;stop().then(()=>app.quit());}}});
 });
 app.on('window-all-closed',()=>app.quit());
 app.on('before-quit',e=>{if(host){e.preventDefault();stop().then(()=>app.quit());}});
}
