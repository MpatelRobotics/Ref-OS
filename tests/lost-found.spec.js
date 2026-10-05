import {test,expect} from '@playwright/test';
test('Lost & Found is a workspace tab and normal navigation remains usable',async({page,isMobile})=>{
 await page.route('https://example.supabase.co/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 await page.route('**/src/lostFound*',r=>r.fulfill({contentType:'text/javascript',body:'export const listLostFound=async()=>[];export const saveLostFound=async()=>{};export const setLostFoundReturned=async()=>{};export const prepareItemPhoto=async()=>({});export const lostFoundPhoto=async()=>null;'}));
 await page.goto('/');await page.getByRole('button',{name:/Highlander Summit/}).first().click();await page.getByRole('button',{name:'Admin login',exact:true}).click();await page.getByPlaceholder('Admin password').fill('test-admin');await page.getByRole('button',{name:'Enter',exact:true}).click();await page.getByPlaceholder('e.g. Maharshi').fill('BoardTester');await page.getByPlaceholder('Required for exports').nth(0).fill('Board');await page.getByPlaceholder('Required for exports').nth(1).fill('Tester');await page.getByRole('button',{name:'Start logging',exact:true}).click();await page.getByRole('button',{name:'Close Quick Start'}).click();
 const nav=page.getByRole('navigation',{name:isMobile?'Mobile navigation':'Main navigation',exact:true});
 const openBoard=async()=>{if(isMobile){await expect(nav.getByRole('button',{name:'Lost & Found',exact:true})).toHaveCount(0);await expect(nav.getByRole('button',{name:'Robots',exact:true})).toBeVisible();await nav.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Lost & Found',exact:true}).click();}else{const tab=nav.getByRole('button',{name:'Lost & Found',exact:true});await tab.click();await expect(tab).toHaveAttribute('aria-current','page');}};
 await openBoard();await expect(page.getByRole('heading',{name:/Lost & Found ·/})).toBeVisible();
 await nav.getByRole('button',{name:'Teams',exact:true}).click();await expect(page.getByRole('heading',{name:/Lost & Found ·/})).toHaveCount(0);
 if(isMobile)await nav.getByRole('button',{name:'Robots',exact:true}).click();
 await openBoard();await expect(page.getByRole('heading',{name:/Lost & Found ·/})).toBeVisible();
});
async function mount(page,manage=true,fail=false){
 await page.route('**/src/lostFound*',r=>r.fulfill({contentType:'text/javascript',body:`export const listLostFound=async()=>[];export const saveLostFound=async()=>{};export const setLostFoundReturned=async()=>{};export const prepareItemPhoto=async()=>({});export const lostFoundPhoto=async()=>'/missing-photo';`}));
 await page.route('**/lost-found-test',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
 import '/src/index.css';import '/@vite/client';import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default;const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const Board=(await import('/src/components/LostFoundBoard.jsx')).default;
 let rows=[{id:'item1',description:'Blue water bottle',pickup_location:'Volunteer desk',returned:false,created_at:new Date().toISOString(),logged_by:'Staff'}];window.saves=[];let fail=${fail};
 const service={listLostFound:async()=>rows,prepareItemPhoto:async()=>({preview:'data:image/png;base64,AA',blob:new Blob(),mime:'image/jpeg'}),saveLostFound:async item=>{window.saves.push(item);if(fail){fail=false;throw Error('Connection lost. Retry.');}rows=[{...item,pickup_location:item.location,photo_path:item.photo?"test/path":null,returned:false,created_at:new Date().toISOString()},...rows];},setLostFoundReturned:async(id,returned)=>{rows=rows.map(item=>item.id===id?{...item,returned}:item);}};
 ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Board,{eventId:'test',eventName:'Test event',meName:'Staff',canManage:${manage},onClose:()=>{window.closedBoard=true;},service}));
 </script></body></html>`}));await page.goto('/lost-found-test');
}
test('staff add items, search pickup locations, and cannot change returned status',async({page})=>{
 await mount(page,false);await expect(page.getByText('Blue water bottle')).toBeVisible();await expect(page.getByRole('button',{name:'Mark returned'})).toHaveCount(0);
 await page.getByLabel('Item description').fill('Robot tool kit');await page.getByLabel('Pickup location').fill('Pit desk');await page.getByRole('button',{name:'Add item',exact:true}).click();await expect(page.getByText('Robot tool kit', {exact:true})).toBeVisible();
 await page.getByLabel('Search items').fill('Pit desk');await expect(page.getByText('Blue water bottle')).toHaveCount(0);await page.getByRole('button',{name:'Back',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.closedBoard)).toBe(true);
});
test('admin can mark returned and reopen without losing the item',async({page})=>{
 await mount(page);await page.getByRole('button',{name:'Mark returned'}).click();await expect(page.getByText('Blue water bottle')).toHaveCount(0);await page.getByLabel('Show',{exact:true}).selectOption('returned');await expect(page.getByText('Blue water bottle')).toBeVisible();await page.getByRole('button',{name:'Reopen item'}).click();await page.getByLabel('Show',{exact:true}).selectOption('available');await expect(page.getByText('Blue water bottle')).toBeVisible();
});
test('failed saves retain the draft and retry the same item ID',async({page})=>{
 await mount(page,true,true);await page.getByLabel('Item description').fill('Keys');await page.getByLabel('Pickup location').fill('Check-in');await page.getByRole('button',{name:'Add item',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Connection lost');await expect(page.getByLabel('Item description')).toHaveValue('Keys');await page.getByRole('button',{name:'Retry saving item'}).click();await expect(page.getByText('Keys',{exact:true})).toBeVisible();const ids=await page.evaluate(()=>window.saves.map(item=>item.id));expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);
});
test('item photo previews are attached and broken board photos offer retry',async({page})=>{
 await mount(page);await page.getByLabel('Item description').fill('Bag');await page.getByLabel('Pickup location').fill('Front desk');
 await page.getByLabel('Item photo (optional)').setInputFiles({name:'bag.png',mimeType:'image/png',buffer:Buffer.from('test')});await expect(page.getByAltText('Selected found item')).toBeVisible();
 await page.getByRole('button',{name:'Add item',exact:true}).click();await expect(page.getByText('Bag',{exact:true})).toBeVisible();expect(await page.evaluate(()=>Boolean(window.saves[0].photo))).toBe(true);await expect(page.getByRole('button',{name:'Picture unavailable · Retry'})).toBeVisible();await page.getByRole('button',{name:'Picture unavailable · Retry'}).click();await expect(page.getByRole('button',{name:'Picture unavailable · Retry'})).toBeVisible();
});
