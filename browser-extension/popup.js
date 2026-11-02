import {normalizeTmAddress} from '../src/tmAddress.js';
import {hostPattern,hostPatterns} from './security.js';
const input=document.querySelector('#address'),status=document.querySelector('#status');
chrome.storage.local.get('address').then(({address})=>{input.value=address||'';status.textContent=address?'Server configured. Open Ref OS to connect.':'';});
const keyInput=document.querySelector('#apiKey');
chrome.storage.session.get('tmCredentials').then(({tmCredentials})=>{keyInput.value=tmCredentials?.apiKey||'';});
document.querySelector('form:not(#venueForm)').addEventListener('submit',async event=>{
 event.preventDefault();
 try{
  const address=normalizeTmAddress(input.value),pattern=hostPattern(address);
  // Must start from the user's click, before other asynchronous work.
  const granted=await chrome.permissions.request({origins:hostPatterns(address)});
  if(!granted)throw Error('Server access was not allowed. School IT may need to approve it.');
  const previous=await chrome.storage.local.get('address');
  await chrome.storage.local.set({address});
  await chrome.storage.session.set({tmCredentials:{address,apiKey:keyInput.value.trim()}});
  if(previous.address&&hostPattern(previous.address)!==pattern)await releaseUnusedHost(previous.address);
  status.textContent='Connection saved. Open TM Sync Center in Ref OS; your address and key will fill in automatically.';
 }catch(error){status.textContent=error.message;}
});
document.querySelector('#open').addEventListener('click',()=>chrome.tabs.create({url:'https://www.ref-os.fyi/'}));
document.querySelector('#remove').addEventListener('click',async()=>{const {address}=await chrome.storage.local.get('address');await chrome.storage.local.remove('address');await chrome.storage.session.remove('tmCredentials');keyInput.value='';if(address)await releaseUnusedHost(address);input.value='';status.textContent='Server access removed.';});

const venueInput=document.querySelector('#venueAddress'),venueStatus=document.querySelector('#venueStatus'),venueOpen=document.querySelector('#venueOpen');
let venueAddress='';
chrome.storage.local.get('venueAddress').then(saved=>{venueAddress=saved.venueAddress||'';venueInput.value=venueAddress;venueOpen.disabled=!venueAddress;});
document.querySelector('#venueForm').addEventListener('submit',async event=>{
 event.preventDefault();venueStatus.textContent='Checking venue server…';
 try{
  const address=normalizeTmAddress(venueInput.value);
  const allowed=await chrome.permissions.request({origins:hostPatterns(address)});
  if(!allowed)throw Error('Venue access was not allowed. Ask school IT to approve it.');
  const response=await fetch(address+'/api/v1/health',{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Venue server returned HTTP '+response.status+'. Check the server app.');
  const health=await response.json();
  if(health.service!=='refos-venue-server')throw Error('That address is not a Ref-OS venue server. Check its IP address and port.');
  const oldVenue=venueAddress;await chrome.storage.local.set({venueAddress:address});venueAddress=address;if(oldVenue)await releaseUnusedHost(oldVenue);venueOpen.disabled=false;
  venueStatus.textContent='Venue server connected. Open venue Ref-OS and sign in to your event.';
 }catch(error){venueStatus.textContent=error.name==='TimeoutError'?'Server did not respond. Start the host app, connect to the same Wi-Fi, and check the address and firewall.':error instanceof TypeError?'Could not reach the server. Start the host app, check the IP and port, and ask IT about Wi-Fi device isolation.':error.message;}
});
venueOpen.addEventListener('click',()=>{if(venueAddress)chrome.tabs.create({url:venueAddress});});
document.querySelector('#venueRemove').addEventListener('click',async()=>{const oldVenue=venueAddress;await chrome.storage.local.remove('venueAddress');venueAddress='';if(oldVenue)await releaseUnusedHost(oldVenue);venueInput.value='';venueOpen.disabled=true;venueStatus.textContent='Venue address forgotten.';});

async function releaseUnusedHost(oldAddress){
 const saved=await chrome.storage.local.get(['address','venueAddress']);
 if([saved.address,saved.venueAddress].filter(Boolean).some(value=>hostPattern(value)===hostPattern(oldAddress)))return;
 await chrome.permissions.remove({origins:hostPatterns(oldAddress)});
}
