import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, dialog } from 'electron';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnector } from '../tm-bridge/connector.mjs';

const local = name => fileURLToPath(new URL(name, import.meta.url));
let win, tray, server, origin = '', pairingCode = '', port, syncing = false, quitting = false;
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
  if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== new URL('launcher.html', import.meta.url).href) throw Error('Setup is unavailable.');
  const url = new URL(entered);
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('Enter the HTTPS address of your Ref OS website.');
  await stopConnector();
  origin = url.origin; pairingCode = randomBytes(32).toString('hex');
  server = createConnector({ origin, pairingCode });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  port = server.address().port;
  await writeFile(`${app.getPath('userData')}/website.json`, JSON.stringify({ website: url.href }));
  try { await win.loadURL(url.href); } catch { origin = ''; await stopConnector(); await win.loadFile(local('launcher.html')); throw Error('Could not open Ref OS. Check the website address and internet connection.'); }
});
ipcMain.handle('tm:website', async event => {
  if (event.sender !== win?.webContents || event.senderFrame.url !== new URL('launcher.html', import.meta.url).href) return '';
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
    win = new BrowserWindow({ width: 1100, height: 820, minWidth: 440, minHeight: 600, show: !testMode, title: 'Ref OS TM Connect',
      webPreferences: { preload: local('preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    win.setMenuBarVisibility(false);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, url) => { if (!origin || new URL(url).origin !== origin) event.preventDefault(); });
    win.webContents.on('will-redirect', (event, url) => { if (!origin || new URL(url).origin !== origin) event.preventDefault(); });
    win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    tray = new Tray(nativeImage.createFromPath(local('icon.png')));
    tray.setToolTip('Ref OS TM Connect — ready');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Ref OS TM Connect', click: () => win.show() },
      { label: 'Change Ref OS website', click: async () => {
        if (syncing && dialog.showMessageBoxSync(win, { type: 'question', message: 'Stop syncing and change the website?', buttons: ['Keep syncing', 'Stop and change'] }) !== 1) return;
        await stopConnector(); origin = ''; await win.loadFile(local('launcher.html')); win.show();
      } },
      { label: 'Quit and stop syncing', click: () => { quitting = true; app.quit(); } },
    ]));
    tray.on('double-click', () => win.show());
    win.on('close', event => { if (!quitting && syncing) { event.preventDefault(); win.hide(); } });
    await win.loadFile(local('launcher.html'));
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { quitting = true; server?.close(); server?.closeAllConnections(); tray?.destroy(); });
}
