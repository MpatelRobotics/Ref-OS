import {app} from 'electron';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createVenueHostWindow} from './hostWindow.mjs';
if(process.env.REFOS_VENUE_DESKTOP_TEST==='1')app.setPath('userData',mkdtempSync(join(tmpdir(),'refos-venue-desktop-')));
let host,quitting=false;
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.whenReady().then(async()=>{host=createVenueHostWindow();await host.open();});
 app.on('second-instance',()=>host?.open());
 app.on('window-all-closed',()=>app.quit());
 app.on('before-quit',event=>{if(host&&!quitting){event.preventDefault();quitting=true;host.dispose().then(()=>app.quit());}});
}
