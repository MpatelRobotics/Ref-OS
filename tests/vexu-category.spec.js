import {test,expect} from '@playwright/test';
test('VEX U is a separate choice and its lookup blocks V5/IQ codes before calling the API',async({page})=>{
 await page.route('**/vexu-category-test',route=>route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">
 import '/src/index.css';import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,Choice=(await import('/src/components/EventProgramChoice.jsx')).default,Lookup=(await import('/src/components/VexEventLookup.jsx')).default;
 window.lookups=[];window.filters=null;function Harness(){const[program,setProgram]=React.useState('vexu');return React.createElement(React.Fragment,null,React.createElement(Choice,{value:program,onChange:setProgram}),React.createElement(Lookup,{expectedProgram:program,onResult:()=>{},onLookup:async code=>{window.lookups.push(code);return {code,name:'University event',program:'VEX U',teams:[]};},onSearch:async filters=>{window.filters=filters;return {events:[],nextPage:null};}}));}
 DOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
 </script>`}));
 await page.goto('/vexu-category-test');await expect(page.getByRole('radio')).toHaveCount(3);await expect(page.getByRole('radio',{name:'VEX U',exact:false})).toBeChecked();
 const code=page.getByLabel('Autofill from VEX Events (optional)');
 for(const value of ['VE-V5-27-12345','VE-IQ-27-12345']){await code.fill(value);await page.getByRole('button',{name:'Look up',exact:true}).click();await expect(page.getByRole('alert')).toContainText('VEX U events require a VEX U code');}
 expect(await page.evaluate(()=>window.lookups.length)).toBe(0);
 await expect(page.getByLabel('Event search program',{exact:true})).toHaveValue('VURC');await expect(page.getByLabel('Event search program',{exact:true})).toBeDisabled();
 await page.getByLabel('State or territory',{exact:true}).selectOption('New York');await page.getByRole('button',{name:'Find events',exact:true}).click();expect((await page.evaluate(()=>window.filters)).program).toBe('VURC');
 await code.fill('VE-U-26-66279');await page.getByRole('button',{name:'Look up',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'University event'})).toBeVisible();expect(await page.evaluate(()=>window.lookups)).toEqual(['VE-U-26-66279']);
});
