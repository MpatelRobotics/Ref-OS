import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const source=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const details=source.slice(source.indexOf('function RuleViolationDetails('),source.indexOf('/* ============================ RULE PICKER'));
const picker=source.slice(source.indexOf('function RulePicker('),source.indexOf('/* ============================ ADD TEAM MODAL'));
const moduleText=transformSync(`import React from '/node_modules/.vite/deps/react.js';const {useState}=React;import ReactDOM from '/node_modules/.vite/deps/react-dom.js';const {createPortal}=ReactDOM;import {ChevronLeft,Search,Star} from '/node_modules/.vite/deps/lucide-react.js';const fmtRule=c=>'<'+c+'>';${details}${picker.replace('function RulePicker(', 'export default function RulePicker(')}`,{loader:'jsx',format:'esm'}).code;
async function mount(page){
 await page.route('**/rule-details.js',r=>r.fulfill({contentType:'text/javascript',body:moduleText}));
 await page.route('**/rule-details-test',r=>r.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">import '/src/index.css';const React=(await import('/node_modules/.vite/deps/react.js')).default;const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const Picker=(await import('/rule-details.js')).default;const {parseViolationRuleNotes,formatViolationRuleNotes} = await import('/src/violationRuleNotes.js');function Harness(){const [selected,setSelected]=React.useState([]);const [details,setDetails]=React.useState(parseViolationRuleNotes().details);return React.createElement(Picker,{eventId:'test',rules:[{code:'SG9',desc:'Alliance Goals are protected',category:'Game'},{code:'SG10',desc:'Neutral Goals',category:'Game'}],knownRules:{},selectedCodes:selected.map(r=>r.code),selectedRules:selected,ruleDetails:details,onSetRuleDetails:setDetails,onSetRuleType:()=>{},onPickRule:(code,desc)=>setSelected(rs=>rs.some(r=>r.code===code)?rs.filter(r=>r.code!==code):[...rs,{code,desc,type:'minor'}]),onClose:()=>{window.notes=formatViolationRuleNotes('',selected.map(r=>r.code),details);}});}DOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));</script></body></html>`}));
 await page.goto('/rule-details-test');
}
test('SG9 prompts expand inside selected rule row and optional counts follow action',async({page})=>{
 await mount(page);await expect(page.getByLabel('What happened?',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:/<SG9> Alliance Goals/}).click();
 await page.getByLabel('What happened?',{exact:true}).selectOption('Touch');await page.getByLabel('SG9: How many touched?').fill('3');
 await page.getByRole('button',{name:/Done/}).filter({visible:true}).click();await expect.poll(()=>page.evaluate(()=>window.notes)).toBe('[SG9] Touch; count: 3');
 await page.getByLabel('What happened?',{exact:true}).selectOption('Descore');await page.getByLabel('SG9: How many descored?').fill('2');
 for(const action of ['Cover','Push']){await page.getByLabel('What happened?',{exact:true}).selectOption(action);await expect(page.getByRole('spinbutton')).toHaveCount(0);}
});
test('SG10 count is optional and supplied counts are recorded',async({page})=>{
 await mount(page);await page.getByRole('button',{name:/<SG10> Neutral/}).click();
 await page.getByRole('button',{name:/Done/}).filter({visible:true}).click();await expect.poll(()=>page.evaluate(()=>window.notes)).toBe('');
 await page.getByLabel('SG10: How many descored?').fill('4');await page.getByRole('button',{name:/Done/}).filter({visible:true}).click();await expect.poll(()=>page.evaluate(()=>window.notes)).toBe('[SG10] Descored: 4');
});
