import {test,expect} from '@playwright/test';
async function mount(page,denied=false){
 await page.route('**/private-tests-fixture',route=>route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default;const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const View=(await import('/src/components/DeveloperTestEvents.jsx')).default;await import('/src/index.css');window.calls=[];window.opened='';const service={listDeveloperTestEvents:async()=>[],createDeveloperTestEvent:async(...args)=>{window.calls.push(args);if(${denied})throw Error('Developer access required');return {id:'private-one',name:args[0],format:args[1]};},openDeveloperTestEvent:async id=>{window.calls.push(['open',id]);},deleteDeveloperTestEvent:async(id,name)=>{window.calls.push(['delete',id,name]);},seedDeveloperTestMatches:async id=>{window.calls.push(['schedule',id]);return 48;}};DOM.createRoot(document.getElementById('root')).render(React.createElement(View,{service,onOpen:id=>window.opened=id}));</script>`}));
 await page.goto('/private-tests-fixture');
}
test('developer creates a private league with optional sample teams and opens it',async({page})=>{
 await mount(page);await page.getByText('Create a private test event',{exact:true}).click();
 await page.getByLabel('Test event name').fill('Private League');await page.getByLabel('Event format').selectOption('league');await page.getByLabel('Include 32 fictional teams and 48 qualification matches').uncheck();
 await page.getByRole('button',{name:'Create Test Event',exact:true}).click();await expect(page.getByRole('heading',{name:'Private League'})).toBeVisible();await expect(page.getByLabel('Event Admin code')).toHaveCount(0);
 expect(await page.evaluate(()=>window.calls[0])).toEqual(['Private League','league',false]);
 await page.getByRole('button',{name:'Open Test Event',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.opened)).toBe('private-one');
});
test('denied creation reports an error and never opens a public fallback event',async({page})=>{
 await mount(page,true);await page.getByText('Create a private test event',{exact:true}).click();await page.getByRole('button',{name:'Create Test Event',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Developer access required');await expect(page.getByRole('button',{name:'Open Test Event',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>window.opened)).toBe('');
});

test('developer can delete a test event after confirming, with no passcode field',async({page})=>{
 await mount(page);await page.getByText('Create a private test event',{exact:true}).click();await page.getByRole('button',{name:'Create Test Event',exact:true}).click();await expect(page.getByRole('button',{name:'Delete Test Event',exact:true})).toBeVisible();
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Delete Test Event',exact:true}).click();await expect(page.getByRole('button',{name:'Delete Test Event',exact:true})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Delete Test Event',exact:true}).click();await expect(page.getByText('No private test events yet.')).toBeVisible();expect(await page.evaluate(()=>window.calls.at(-1))).toEqual(['delete','private-one','Developer Test Event']);
});

test('existing private events can add a fictional schedule',async({page})=>{
 await mount(page);await page.getByText('Create a private test event',{exact:true}).click();await page.getByRole('button',{name:'Create Test Event',exact:true}).click();await page.getByRole('button',{name:'Add Fictional Schedule',exact:true}).click();await expect(page.getByRole('status')).toContainText('Added 48 qualification matches');expect(await page.evaluate(()=>window.calls.at(-1))).toEqual(['schedule','private-one']);
});
