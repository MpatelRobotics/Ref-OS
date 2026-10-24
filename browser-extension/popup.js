import {normalizeTmAddress} from '../src/tmAddress.js';
import {hostPattern,hostPatterns} from './security.js';
const input=document.querySelector('#address'),status=document.querySelector('#status');
chrome.storage.local.get('address').then(({address})=>{input.value=address||'';status.textContent=address?'Server configured. Open Ref OS to connect.':'';});
document.querySelector('form').addEventListener('submit',async event=>{
 event.preventDefault();
 try{
  const address=normalizeTmAddress(input.value),pattern=hostPattern(address);
  // Must start from the user's click, before other asynchronous work.
  const granted=await chrome.permissions.request({origins:hostPatterns(address)});
  if(!granted)throw Error('Server access was not allowed. School IT may need to approve it.');
  const previous=await chrome.storage.local.get('address');
  await chrome.storage.local.set({address});
  if(previous.address&&hostPattern(previous.address)!==pattern)await chrome.permissions.remove({origins:hostPatterns(previous.address)});
  status.textContent='TM server allowed. Reload Ref OS, then open TM Sync Center.';
 }catch(error){status.textContent=error.message;}
});
document.querySelector('#open').addEventListener('click',()=>chrome.tabs.create({url:'https://www.ref-os.fyi/'}));
document.querySelector('#remove').addEventListener('click',async()=>{const {address}=await chrome.storage.local.get('address');await chrome.storage.local.remove('address');if(address)await chrome.permissions.remove({origins:hostPatterns(address)});input.value='';status.textContent='Server access removed.';});
