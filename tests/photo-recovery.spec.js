import { test, expect } from '@playwright/test';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE7sAAAAASUVORK5CYII=', 'base64');
async function mount(page, corruptCache = false) {
  await page.route('**/src/api.js*', (route) => route.fulfill({ contentType: 'text/javascript', body: 'export async function photoUrl() { return "/test-photo-image"; }' }));
  await page.route('**/photo-recovery-test', (route) => route.fulfill({contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
    import '/@vite/client'; import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const ReactDOM = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const cache = await import('/src/photoCache.js');
    const Photo = (await import('/src/components/PhotoThumbnail.jsx')).default;
    const path = 'test-event/team/1/front-test.jpg';
    ${corruptCache ? "await cache.putCachedBlob(path, new Blob(['broken image'], {type:'image/jpeg'}));" : ''}
    const root = ReactDOM.createRoot(document.getElementById('root'));
    window.remountPhoto = () => root.render(React.createElement(Photo, {key:Date.now(), pkey:path, full:true}));
    window.remountPhoto();
  </script></body></html>`}));
  await page.goto('/photo-recovery-test');
}
test('a broken cached image is replaced with a fresh decodable cloud copy', async ({page}) => {
  let downloads = 0;
  await page.route('**/test-photo-image', (route) => { downloads++; return route.fulfill({contentType:'image/png',body:PNG}); });
  await mount(page,true);
  await expect.poll(() => page.locator('img').evaluateAll((imgs) => imgs.some((im) => im.complete && im.naturalWidth===1))).toBe(true);
  expect(downloads).toBe(1);
});
test('unreadable downloads stop automatically and can be retried', async ({page}) => {
  let valid = false; let downloads = 0;
  await page.route('**/test-photo-image', (route) => { downloads++; return route.fulfill({contentType:'image/png',body:valid?PNG:Buffer.from('invalid')}); });
  await mount(page);
  await expect(page.getByRole('button',{name:'Retry loading robot picture'})).toBeVisible();
  expect(downloads).toBe(2);
  valid = true;
  await page.getByRole('button',{name:'Retry loading robot picture'}).click();
  await expect.poll(() => page.locator('img').evaluateAll((imgs) => imgs.some((im) => im.naturalWidth===1))).toBe(true);
});
test('valid downloaded photos still display from cache offline', async ({page,context}) => {
  await page.route('**/test-photo-image', (route) => route.fulfill({contentType:'image/png',body:PNG}));
  await mount(page);
  await expect.poll(() => page.locator('img').evaluateAll((imgs) => imgs.some((im) => im.naturalWidth===1))).toBe(true);
  await context.setOffline(true);
  await page.evaluate(() => window.remountPhoto());
  await expect.poll(() => page.locator('img').evaluateAll((imgs) => imgs.some((im) => im.naturalWidth===1))).toBe(true);
  await context.setOffline(false);
});
