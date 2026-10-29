import {test,expect} from '@playwright/test';
import {DEMO_EVENTS} from '../src/demoEvents.js';
test('demo code comes before program choice and routes each program separately',async({page})=>{
 await page.route('**/demo-launcher-test',route=>route.fulfill({contentType:'text/html',body:`<html><body><div id="root"></div><script type="module">
 const React=(await import('/node_modules/.vite/deps/react.js')).default;
 const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
 const RefreshRuntime=(await import('/@react-refresh')).default;RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
 const C=(await import('/src/components/DemoLauncher.jsx')).default;
 DOM.createRoot(document.getElementById('root')).render(React.createElement(C,{onChoose:id=>window.chosen=id}));
 </script></body></html>`}));
 await page.goto('/demo-launcher-test');
 await page.getByRole('button',{name:'Try the DEMO'}).click();

 await page.getByLabel('Demo code').fill('NOPE');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
 await page.getByLabel('Demo code').fill('DEMOV5');await page.getByRole('button',{name:'Continue',exact:true}).click();
 expect(await page.evaluate(()=>window.chosen)).toBe(DEMO_EVENTS.v5);
 expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('refosDemoEntry')).code)).toBe('DEMOV5');
});

test('event selector and demo form use readable text in dark mode',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('refosTheme','dark'));
 await page.route('https://example.supabase.co/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 await page.goto('/');
 await expect(page.getByText(/Explore V5 Override with 32 fictional teams/)).toHaveCSS('color','rgb(241, 245, 249)');
 await expect(page.getByRole('button',{name:'Expand all',exact:true})).toHaveCSS('color','rgb(241, 245, 249)');
 await page.getByRole('button',{name:'Try the DEMO',exact:true}).click();
 await expect(page.getByRole('button',{name:'Cancel',exact:true})).toHaveCSS('color','rgb(241, 245, 249)');
 await expect(page.getByRole('heading',{name:'Try Ref OS',exact:true})).toHaveCSS('color','rgb(241, 245, 249)');
});

test('event directory fills desktop width and groups become a mobile column',async({page})=>{
 await page.route('https://example.supabase.co/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 await page.route(/\/src\/api(?:\.js)?(?:\?.*)?$/,async r=>{const response=await r.fetch();const source=(await response.text()).replace('name: "Highlander Summit", branding: {} }];','name: "Highlander Summit", branding: {} },{id:"22222222-2222-4222-8222-222222222222",name:"Colorado fixture",state:"CO",branding:{}}];');await r.fulfill({response,body:source});});
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');
 const catalog=page.locator('.refos-event-catalog');await expect(catalog.locator('details')).toHaveCount(2);
 expect((await catalog.boundingBox()).width).toBeGreaterThan(1300);
 const groups=await catalog.locator('details').all();expect((await groups[0].boundingBox()).y).toBe((await groups[1].boundingBox()).y);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect((await groups[1].boundingBox()).y).toBeGreaterThan((await groups[0].boundingBox()).y);
});

test('event selector theme button toggles both ways and remembers the choice',async({page})=>{
 await page.route('https://example.supabase.co/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 await page.goto('/');await page.getByRole('button',{name:'Dark mode',exact:true}).click();
 await expect(page.locator('html')).toHaveClass(/dark/);await page.reload();await expect(page.getByRole('button',{name:'Light mode',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Light mode',exact:true}).click();await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('selector sidebar opens demo, archives, event creation and returns to events',async({page})=>{
 await page.route('https://example.supabase.co/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Event selection navigation'});
 await page.mouse.move(1000,700);await expect(nav).toHaveCSS('width','64px');
 await nav.hover();await expect(nav).toHaveCSS('width','224px');
 await nav.getByRole('button',{name:'Try the demo',exact:true}).click();await expect(page.getByLabel('Demo code')).toBeVisible();await expect(nav).toHaveCSS('width','64px');
 await nav.getByRole('button',{name:'Archived events',exact:true}).click();await expect(page.getByRole('heading',{name:'Archived Events',exact:true})).toBeVisible();
 await nav.getByRole('button',{name:'Create event',exact:true}).click();await expect(page.getByRole('heading',{name:'Create VEX Event',exact:true})).toBeVisible();
 await nav.getByRole('button',{name:'Events',exact:true}).click();await expect(page.getByRole('heading',{name:'Create VEX Event',exact:true})).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/event-selector-sidebar-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.mouse.move(1000,700);await page.screenshot({path:'test-results/event-selector-sidebar-desktop.png',fullPage:true});
});
