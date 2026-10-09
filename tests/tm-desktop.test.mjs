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
    await page.route('https://refos.example.test/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Ref OS test event</h1>' }));
    await page.getByLabel('Ref OS website address').fill('https://refos.example.test');
    await page.getByRole('button', { name: 'Open Ref OS' }).click();
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


