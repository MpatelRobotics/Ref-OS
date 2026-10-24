import test from 'node:test';
import assert from 'node:assert/strict';
import { _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';

test('real desktop opens securely, reaches its native connector, and hides while syncing', { timeout: 40000 }, async () => {
  const desktop = await electron.launch({ timeout: 15000, ...(process.env.REFOS_PACKAGED_EXE ? { executablePath: process.env.REFOS_PACKAGED_EXE, args: [] } : { args: ['desktop/build/main.mjs'] }), env: { ...process.env, REFOS_DESKTOP_TEST: '1' } });
  try {
    const page = await desktop.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    assert.equal(await page.title(), 'Ref OS TM Connect');
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    const prefs = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
    assert.equal(prefs.contextIsolation, true); assert.equal(prefs.sandbox, true); assert.equal(prefs.nodeIntegration, false); assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getBackgroundThrottling()), false);
    const invalid = await page.evaluate(async () => { try { await window.refosTmDesktop.openWebsite('http://unsafe.example'); return false; } catch { return true; } });
    assert.equal(invalid, true);
    if (!process.env.REFOS_PACKAGED_EXE) await page.screenshot({ path: resolve('desktop/build/launcher-preview.png') });
    const launcherUrl=page.url();
    await page.route('https://www.ref-os.fyi/**', route => route.fulfill({contentType:'text/html',body:'<h1>Automatic Ref OS launch</h1>'}));
    await desktop.evaluate(async ({BrowserWindow}) => {
      const win=BrowserWindow.getAllWindows()[0];
      const url=new URL(win.webContents.getURL());url.search='?autoOpen=1';
      await win.loadURL(url.href);
    });
    await page.waitForURL('https://www.ref-os.fyi/');
    assert.equal(await page.locator('h1').innerText(),'Automatic Ref OS launch');
    await desktop.evaluate(async ({BrowserWindow},url) => {
      await BrowserWindow.getAllWindows()[0].loadURL(url);
    },launcherUrl);
    await page.route('https://blocked.example.test/**', route => route.abort('connectionrefused'));
    await page.getByLabel('Ref OS website address').fill('https://blocked.example.test');
    await page.getByRole('button', { name: 'Open Ref OS', exact:true }).click();
    await page.waitForURL('**/launcher.html');
    await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('ERR_CONNECTION_REFUSED'));
    assert.match(await page.locator('#status').innerText(), /school IT/);
    assert.equal(await page.getByRole('button',{name:'Retry connection',exact:true}).isVisible(),true);
    assert.equal(await page.getByRole('button',{name:'Open Windows proxy settings',exact:true}).isVisible(),true);
    assert.ok(await page.locator('#fix-steps li').count()>=2);
    if (!process.env.REFOS_PACKAGED_EXE) await page.screenshot({path:resolve('desktop/build/network-help-preview.png'),fullPage:true});
    await page.route('https://refos.example.test/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Ref OS test event</h1>' }));
    await page.getByLabel('Ref OS website address').fill('https://refos.example.test');
    await page.getByRole('button', { name: 'Open Ref OS', exact:true }).click();
    await page.waitForURL('https://refos.example.test/');
    assert.equal(await page.evaluate(() => typeof window.refosTmDesktop.request), 'function');
    const error = await page.evaluate(async () => { try { await window.refosTmDesktop.request('snapshot', {}); } catch (error) { return error.message; } });
    assert.match(error, /Enter |TM |authorize/);
    const forbidden = await page.evaluate(async () => { try { await window.refosTmDesktop.request('arbitrary-route', {}); return false; } catch { return true; } });
    assert.equal(forbidden, true);
    await page.evaluate(() => window.refosTmDesktop.setSyncActive(true));
    await desktop.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.show(); win.close(); });
    assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
    await page.evaluate(() => window.refosTmDesktop.setSyncActive(false));
    await page.route('https://other.example.test/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Other website</h1>' }));
    await desktop.evaluate(async ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].loadURL('https://other.example.test/'));
    const untrusted = await page.evaluate(async () => { try { await window.refosTmDesktop.request('activity', {}); return false; } catch { return true; } });
    assert.equal(untrusted, true);
  } finally { await desktop.close(); }
});


