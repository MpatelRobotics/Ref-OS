import {test,expect} from '@playwright/test';
test('optional radio directory and checkout save, reject duplicates and handle failures',async({page})=>{
 await page.route('**/radio-test',route=>route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">
 const React=(await import('/node_modules/.vite/deps/react.js')).default;
 const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
 const RefreshRuntime=(await import('/@react-refresh')).default;RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
 const C=(await import('/src/components/RadioManagement.jsx')).default;
 function App(){const [data,setData]=React.useState(JSON.parse(localStorage.getItem('radios')||'{"channels":[],"radios":[]}'));return React.createElement(C,{data,volunteers:[{name:'Pat'}],onSave:async update=>{if(window.failSave)throw Error('Test connection failure');const next=update(data);localStorage.setItem('radios',JSON.stringify(next));setData(next);}});}DOM.createRoot(document.getElementById('root')).render(React.createElement(App));
 </script>`}));
 await page.setViewportSize({width:390,height:844});await page.goto('/radio-test');
 await expect(page.getByText('No radios added. You can leave this empty.')).toBeVisible();
 await page.getByLabel('Crew',{exact:true}).fill('Field crew');await page.getByLabel('Channel',{exact:true}).fill('2');await page.getByRole('button',{name:'Add channel',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Channel saved.');
 await page.getByLabel('Radio number or label').fill('01');await page.getByRole('button',{name:'Add radio',exact:true}).click();
 await page.getByLabel('Borrower for 01').fill('Pat');await page.getByRole('button',{name:'Check out',exact:true}).click();
 await expect(page.getByText('Checked out to Pat',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('Checked out to Pat',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Mark returned'}).click();await expect(page.getByText('Available',{exact:true})).toBeVisible();
 await page.getByLabel('Radio number or label').fill('01');await page.getByRole('button',{name:'Add radio',exact:true}).click();await expect(page.getByRole('alert')).toContainText('already listed');
 await page.evaluate(()=>window.failSave=true);await page.getByRole('button',{name:'Remove radio',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Check your connection');await expect(page.getByText('Available',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.failSave=false);await page.getByRole('button',{name:'Remove radio',exact:true}).click();await expect(page.getByText('No radios added. You can leave this empty.')).toBeVisible();
});
