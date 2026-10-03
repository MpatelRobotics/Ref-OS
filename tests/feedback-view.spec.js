import { test, expect } from '@playwright/test';
async function mount(page, developer = true, empty = false) {
  const entries = empty ? [] : [
    {id:'old',kind:'feedback',note:'Add a timer',by:'Alex',createdAt:1000},
    {id:'new',kind:'feedback',note:'Photo failed to load',by:'Sam',createdAt:2000},
    {id:'private',kind:'role_access_codes',note:'Do not display internal records',by:'Admin',createdAt:3000}
  ];
  await page.route('**/feedback-view-test', route => route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
    import '/@vite/client'; import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;
    const React=(await import('/node_modules/.vite/deps/react.js')).default;
    const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const Viewer=(await import('/src/components/FeedbackViewer.jsx')).default;
    window.feedbackClosed=false;
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Viewer,{isDeveloper:${developer},entries:${JSON.stringify(entries)},eventName:'Test event',sessionName:'Session 2',onClose:()=>window.feedbackClosed=true}));
  </script></body></html>`}));
  await page.goto('/feedback-view-test');
  await expect.poll(() => page.evaluate(() => window.feedbackClosed)).toBe(false);
}
test('developer sees newest feedback, can search and return',async({page})=>{
  await mount(page);
  await expect(page.getByRole('heading',{name:'View Feedback'})).toBeVisible();
  await expect(page.locator('article')).toHaveCount(2);
  await expect(page.locator('article').first()).toContainText('Photo failed to load');
  await expect(page.getByText('Do not display internal records')).toHaveCount(0);
  await page.getByRole('textbox',{name:'Search feedback'}).fill('Alex');
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.locator('article')).toContainText('Add a timer');
  await page.getByRole('textbox',{name:'Search feedback'}).fill('unmatched');
  await expect(page.getByRole('status')).toHaveText('No feedback matches your search.');
  await page.getByRole('button',{name:'Back to Features & Help'}).click();
  expect(await page.evaluate(()=>window.feedbackClosed)).toBe(true);
});
test('non-developer receives no feedback screen or messages',async({page})=>{
  await mount(page,false);
  await expect(page.locator('#root')).toBeEmpty();
});
test('empty current event or session explains missing submissions',async({page})=>{
  await mount(page,true,true);
  await expect(page.getByRole('status')).toContainText('No feedback submissions in this event or session yet.');
});

