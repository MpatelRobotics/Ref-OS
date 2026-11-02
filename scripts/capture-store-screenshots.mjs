import {_electron as electron} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
await mkdir('store-assets/microsoft',{recursive:true});
const app=await electron.launch({args:['desktop/build/main.mjs'],env:{...process.env,REFOS_DESKTOP_TEST:'1'}});
try{
const home=await app.firstWindow();await home.waitForLoadState();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1366,1050));
await home.screenshot({path:'store-assets/microsoft/desktop-home.png',scale:'css'});
const opening=app.waitForEvent('window');await home.getByRole('button',{name:'Manage Venue Server',exact:true}).click();const host=await opening;await host.waitForLoadState();
await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/venue/index.html')).setContentSize(1366,1050));
await host.screenshot({path:'store-assets/microsoft/venue-controls.png',scale:'css'});
}finally{await app.close();}
