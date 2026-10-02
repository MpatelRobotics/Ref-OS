import { test, expect } from '@playwright/test';

// Exercise the actual production guide component through Vite without live event access.
async function openGuide(page, role = 'Admin') {
  await page.route('**/guide-test', (route) => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">
    import '/@vite/client';
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const ReactDOM = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const UserGuide = (await import('/src/components/UserGuide.jsx')).default;
    await import('/src/index.css');
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(UserGuide, {role: ${JSON.stringify(role)}, onClose: () => {document.getElementById('root').textContent = 'Closed guide';}}));
  </script></body></html>` }));
  await page.goto('/guide-test');
  await expect(page.getByRole('heading', { name: 'Ref OS User Guide', exact: true })).toBeVisible();
}
test('search, article, related links, back, and empty state', async ({ page }) => {
  await openGuide(page);
  await page.getByLabel('Search the guide').fill('violation');
  await page.getByRole('button', { name: /^Log and correct a violation/ }).click();
  await expect(page.getByRole('heading', { name: 'How to use it' })).toBeVisible();
  await page.getByRole('button', { name: 'Search rules, manual, and Official Q&A' }).click();
  await expect(page.getByRole('heading', { name: 'Search rules, manual, and Official Q&A', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Back to User Guide' }).click();
  await expect(page.getByLabel('Search the guide')).toHaveValue('violation');
  await page.getByLabel('Search the guide').fill('no-such-guide-phrase');
  await expect(page.getByText(/No matching articles/)).toBeVisible();
  await page.getByRole('button', { name: 'Back to Features & Help' }).click();
  await expect(page.getByText('Closed guide')).toBeVisible();
});
test('Inspection hides administration and disciplinary entry articles', async ({ page }) => {
  await openGuide(page, 'Inspection');
  await expect(page.getByRole('button', { name: /^Clear Event Data safely/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Log and correct a violation/ })).toHaveCount(0);
  await page.getByLabel('Search the guide').fill('Maharshi Patel');
  await expect(page.getByRole('heading', { name: 'About the Founder' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('1 result');
  await expect(page.getByText(/2022 VEX World Championship/)).toBeVisible();
  await page.getByLabel('Search the guide').fill('');
  await page.getByLabel('Category').selectOption('Inspection');
  await page.getByRole('button', { name: /^Robot pictures and completion/ }).click();
  await expect(page.getByText(/Inspection can capture or retake pictures but cannot delete them/)).toBeVisible();
});
test('loaded guide search and reading work without network and fit mobile width', async ({ page, context }) => {
  await openGuide(page);
  await context.setOffline(true);
  await page.getByLabel('Search the guide').fill('offline');
  await page.getByRole('button', { name: /^Prepare for offline use/ }).click();
  await expect(page.getByRole('heading', { name: 'How to use it' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.setOffline(false);
});
test('Features & Help and contextual help open the guide in the real workspace', async ({ page }) => {
  await page.route('https://example.supabase.co/**', (route) => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.getByRole('button', { name: /Highlander Summit/ }).first().click();
  await page.getByRole('button', { name: 'Admin login', exact: true }).click();
  await page.getByPlaceholder('Admin password').fill('test-admin');
  await page.getByRole('button', { name: 'Enter', exact: true }).click();
  await page.getByPlaceholder('e.g. Maharshi').fill('GuideTester');
  await page.getByPlaceholder('Required for exports').nth(0).fill('Guide');
  await page.getByPlaceholder('Required for exports').nth(1).fill('Tester');
  await page.getByRole('button', { name: 'Start logging', exact: true }).click();
  await page.getByRole('button', { name: 'Close Quick Start' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Features & Help/i }).click();
  await expect(page.getByRole('heading', { name: 'About the Founder' })).toBeVisible();
  await expect(page.getByText(/test engineer at Lockheed Martin/)).toBeVisible();
  await page.getByRole('button', { name: /^User Guide/ }).click();
  await expect(page.getByRole('heading', { name: 'Ref OS User Guide', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Features & Help' }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Help with this section' }).click();
  await expect(page.getByRole('heading', { name: 'Schedules and match details', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('contextual-guide.png'), fullPage: true });
});
