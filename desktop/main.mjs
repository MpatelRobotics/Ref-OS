import { connectionFailure, connectionDetails } from './networkErrors.mjs';
import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, dialog, shell, clipboard } from 'electron';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnector } from '../tm-bridge/connector.mjs';

const local = name => fileURLToPath(new URL(name, import.meta.url));
const isLauncher = value => { const url = new URL(value); url.search = ''; url.hash = ''; return url.href === new URL('launcher.html', import.meta.url).href; };
let lastConnectionError = '', lastConnectionHelp = null;
let venueHost, shuttingDown=false;
let win, tray, server, origin = '', pairingCode = '', port, syncing = false, quitting = false;
async function openVenue(){if(!venueHost){const {createVenueHostWindow}=await import('./venue/hostWindow.mjs');const legacy=['Ref OS Venue Server','refos-venue-server'].map(name=>join(app.getPath('appData'),name,'venue-data')).find(path=>existsSync(join(path,'refos-venue.sqlite')));venueHost=createVenueHostWindow({resources:app.isPackaged?process.resourcesPath:local('resources/'),keepRunningOnClose:true,dataDirectory:testMode?undefined:legacy});}return venueHost.open();}
ipcMain.handle('desktop:status',event=>{if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame||!isLauncher(event.senderFrame.url))throw Error('Desktop status unavailable.');return {syncing,hosting:venueHost?.isRunning()||false};});
ipcMain.handle('desktop:venue',async event=>{if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame||!isLauncher(event.senderFrame.url))throw Error('Open the desktop home screen first.');await openVenue();return true;});
const testMode = process.env.REFOS_DESKTOP_TEST === '1';
if (testMode) app.setPath('userData', mkdtempSync(join(tmpdir(), 'refos-tm-test-')));
function trusted(event) {
  return event.sender === win?.webContents && event.senderFrame === win.webContents.mainFrame &&
    origin && new URL(event.senderFrame.url).origin === origin;
}
async function stopConnector() {
  syncing = false;
  if (server) { const old = server; server = null; await new Promise(resolve => { old.close(resolve); old.closeAllConnections(); }); }
}
ipcMain.handle('tm:open', async (event, entered) => {
  if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame || !isLauncher(event.senderFrame.url)) throw Error('Setup is unavailable.');
  let url;
  try { url = new URL(entered); } catch { throw Error('Enter the HTTPS address of your Ref OS website.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('Enter the HTTPS address of your Ref OS website.');
  await stopConnector();
  lastConnectionError = ''; lastConnectionHelp = null;
  let stage = 'website';
  try {
    // Re-read managed Windows proxy/PAC settings after changing networks.
    await win.webContents.session.forceReloadProxyConfig();
    stage = 'local';
    origin = url.origin; pairingCode = randomBytes(32).toString('hex');
    server = createConnector({ origin, pairingCode });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    port = server.address().port;
    await writeFile(`${app.getPath('userData')}/website.json`, JSON.stringify({ website: url.href }));
    stage = 'website';
    await win.loadURL(url.href);
    // A successful HTML response can still leave an empty window if the app's
    // scripts fail to load. Return to setup instead of stranding the user there.
    const ready = await win.webContents.executeJavaScript(`new Promise(resolve => {
      const started = Date.now();
      const check = () => {
        const root = document.querySelector('#root') || document.body;
        if (root?.innerText.trim() || root?.querySelector('canvas, input, button')) return resolve(true);
        if (Date.now() - started >= 15000) return resolve(false);
        setTimeout(check, 200);
      };
      check();
    })`);
    if (!ready) throw Object.assign(new Error('The website loaded without app content.'), { code: 'ERR_APP_NOT_READY' });
  } catch (error) {
    lastConnectionHelp = connectionDetails(error, stage);
    lastConnectionError = connectionFailure(error, stage);
    origin = ''; await stopConnector();
    await win.loadFile(local('launcher.html'));
    throw Error(lastConnectionError);
  }
});
ipcMain.handle('tm:connection-error', async event => {
  if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame || !isLauncher(event.senderFrame.url)) return '';
  return lastConnectionHelp;
});
ipcMain.handle('tm:network-help', async (event, action, entered) => {
  if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame || !isLauncher(event.senderFrame.url)) throw Error('Setup is unavailable.');
  if(action==='browser'){
    const url=new URL(entered);
    if(url.protocol!=='https:'||url.username||url.password)throw Error('Enter an HTTPS website address first.');
    await shell.openExternal(url.href);
  }else if(action==='proxy' && process.platform==='win32')await shell.openExternal('ms-settings:network-proxy');
  else if(action==='copy')clipboard.writeText(`Ref OS TM Connect ${app.getVersion()}\n${lastConnectionError || 'No connection error recorded.'}`);
  else throw Error('Unknown troubleshooting action.');
});
ipcMain.handle('tm:website', async event => {
  if (event.sender !== win?.webContents || !isLauncher(event.senderFrame.url)) return '';
  try { return JSON.parse(await readFile(`${app.getPath('userData')}/website.json`, 'utf8')).website; } catch { return ''; }
});
ipcMain.handle('tm:request', async (event, route, body) => {
  if (!trusted(event) || !server || !['snapshot', 'activity', 'disconnect'].includes(route)) throw Error('TM connection is unavailable.');
  if (!body || typeof body !== 'object' || JSON.stringify(body).length > 20000) throw Error('Invalid TM request.');
  const response = await fetch(`http://127.0.0.1:${port}/${route}`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'x-refos-pairing': pairingCode },
    body: JSON.stringify(body), signal: AbortSignal.timeout(route === 'snapshot' ? 45000 : 5000),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'TM connection failed.');
  return result;
});
ipcMain.handle('tm:active', (event, active) => {
  if (!trusted(event) || typeof active !== 'boolean') throw Error('Invalid sync state.');
  syncing = active; tray?.setToolTip(active ? 'Ref OS TM Connect — syncing' : 'Ref OS TM Connect — ready');
});
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { win?.show(); win?.focus(); });
  app.whenReady().then(async () => {
    win = new BrowserWindow({ width: 1100, height: 820, minWidth: 440, minHeight: 600, show: !testMode, title: 'Ref-OS Desktop', icon: local('icon.png'),
      webPreferences: { preload: local('preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    win.setMenuBarVisibility(false);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, url) => { if (!origin || new URL(url).origin !== origin) event.preventDefault(); });
    win.webContents.on('will-redirect', (event, url) => { if (!origin || new URL(url).origin !== origin) event.preventDefault(); });
    win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    tray = new Tray(nativeImage.createFromPath(local('icon.png')));
    tray.setToolTip('Ref OS TM Connect — ready');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Ref-OS Desktop', click: () => win.show() },
      { label: 'Venue Server', click: () => {void openVenue();} },
      { label: 'Desktop home / Change website', click: async () => {
        if (syncing && dialog.showMessageBoxSync(win, { type: 'question', message: 'Stop syncing and change the website?', buttons: ['Keep syncing', 'Stop and change'] }) !== 1) return;
        await stopConnector(); origin = ''; await win.loadFile(local('launcher.html')); win.show();
      } },
      { label: 'Quit and stop syncing', click: () => { quitting = true; app.quit(); } },
    ]));
    tray.on('double-click', () => win.show());
    win.on('close', event => { if (!quitting && (syncing || venueHost?.isRunning())) { event.preventDefault(); win.hide(); } });
    await win.loadFile(local('launcher.html'), { query: {} });
  });
  app.on('window-all-closed', () => {if(!venueHost?.isRunning())app.quit();});
  app.on('before-quit', event => { quitting=true;if(venueHost&&!shuttingDown){event.preventDefault();shuttingDown=true;venueHost.dispose().then(()=>app.quit());return;}server?.close();server?.closeAllConnections();tray?.destroy(); });
}
