
import {test,expect} from '@playwright/test';
async function mount(page,width){
 await page.setViewportSize({width,height:844});await page.clock.install();
 await page.route('**/menu-idle-test',r=>r.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default,DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,useIdle=(await import('/src/useMobileMenuIdle.js')).default;function App(){const[open,setOpen]=React.useState(false),ref=React.useRef(null);useIdle(ref,open,setOpen);return React.createElement('div',null,React.createElement('button',{onClick:()=>setOpen(!open)},'Settings'),open&&React.createElement('div',{ref,role:'menu',style:{height:100,overflow:'auto'}},React.createElement('button',null,'Keep open'),React.createElement('div',{style:{height:500}},'Menu contents')));}DOM.createRoot(document.getElementById('root')).render(React.createElement(App));</script>`}));
 await page.goto('/menu-idle-test');await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByRole('menu')).toBeVisible();
}
test('mobile gear menu closes after three seconds and reopening starts a fresh timer',async({page})=>{
 await mount(page,390);await page.clock.fastForward(2900);await expect(page.getByRole('menu')).toBeVisible();await page.clock.fastForward(101);await expect(page.getByRole('menu')).toHaveCount(0);
 await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByRole('menu')).toBeVisible();await page.clock.fastForward(3001);await expect(page.getByRole('menu')).toHaveCount(0);
});
test('mobile clicks and scrolling restart the idle timer',async({page})=>{
 await mount(page,390);await page.clock.fastForward(2000);await page.getByRole('button',{name:'Keep open',exact:true}).click();await page.clock.fastForward(2000);await expect(page.getByRole('menu')).toBeVisible();
 await page.getByRole('menu').evaluate(el=>el.dispatchEvent(new Event('scroll')));await page.clock.fastForward(2900);await expect(page.getByRole('menu')).toBeVisible();await page.clock.fastForward(101);await expect(page.getByRole('menu')).toHaveCount(0);
});
test('desktop gear menu remains open',async({page})=>{
 await mount(page,1440);await page.clock.fastForward(10000);await expect(page.getByRole('menu')).toBeVisible();
});
