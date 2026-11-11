import {test,expect} from '@playwright/test';
test('event program choice detects IQ and saves the selected program; links to the official manual',async({page})=>{
 await page.route('**/iq-event-test',r=>r.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
 import '/@vite/client';import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
 const React=(await import('/node_modules/.vite/deps/react.js')).default;const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const Choice=await import('/src/components/EventProgramChoice.jsx');const Modal=(await import('/src/components/modals/EventModal.jsx')).default;const Manual=(await import('/src/components/IQRules.jsx')).default;window.detected=Choice.detectEventProgram({program:'VEX IQ Robotics Competition',code:'VE-IQ-27-1234'});window.saved=null;
 ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,React.createElement(Modal,{event:{name:'IQ fixture',quals:10},competitionProgram:'v5',onClose:()=>{},onSave:data=>window.saved=data}),React.createElement(Manual)));
 </script></body></html>`}));
 await page.goto('/iq-event-test');await expect.poll(()=>page.evaluate(()=>window.detected)).toBe('iq');await page.getByRole('radio',{name:/VEX IQ/}).check();await page.getByRole('button',{name:'Save event',exact:true}).click();expect(await page.evaluate(()=>window.saved.competitionProgram)).toBe('iq');await expect(page.getByRole('listitem')).toHaveCount(78);await page.getByLabel('Search IQ rules').fill('<SG6>');await expect(page.getByRole('listitem')).toHaveCount(1);await expect(page.getByRole('listitem')).toContainText('Bean Bag');await page.getByLabel('Search IQ rules').fill('');await expect(page.getByRole('link',{name:/Official VEX IQ Level Up manual/})).toHaveAttribute('href','https://manuals.vex.com/iq/level-up/v2.1/prefix/');
});



