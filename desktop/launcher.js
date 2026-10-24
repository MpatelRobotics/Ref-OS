const input = document.querySelector('input'), button = document.querySelector('button'), status = document.querySelector('#status');
const showError = info => {
  if (!info) return;
  document.querySelector('#network-help').hidden=false;
  document.querySelector('#error-title').textContent=info.title;
  document.querySelector('#error-code').textContent='Error: '+info.code;
  const list=document.querySelector('#fix-steps');list.replaceChildren();
  for(const step of info.steps){const li=document.createElement('li');li.textContent=step;list.append(li);}
  document.querySelector('#proxy').hidden=!info.proxy;
  status.textContent=info.title+' ('+info.code+'). '+info.steps.join(' ');
};
const openWebsite = async () => {
  if (button.disabled) return;
  button.disabled = true; status.textContent = 'Opening Ref OS…';
  try { await window.refosTmDesktop.openWebsite(input.value.trim()); }
  catch (error) { status.textContent = error.message || 'Could not open Ref OS. Check your website address and internet connection.'; button.disabled = false; }
};
document.querySelector('form').addEventListener('submit', event => {
  event.preventDefault(); void openWebsite();
});
Promise.all([window.refosTmDesktop.savedWebsite(), window.refosTmDesktop.connectionError()]).then(([website, error]) => {
  input.value = website || 'https://www.ref-os.fyi';
  if (error) showError(error);
  // Only the initial launch opts in. Failed connections and Change website stay in setup.
  if (new URLSearchParams(window.location.search).get('autoOpen') === '1' && !error) void openWebsite();
});

document.querySelector('#retry').addEventListener('click',()=>void openWebsite());
for(const action of ['browser','proxy','copy'])document.querySelector('#'+action).addEventListener('click',async()=>{
 const output=document.querySelector('#help-status');
 try{await window.refosTmDesktop.networkHelp(action,input.value.trim());output.textContent=action==='copy'?'Error copied. Send it to school IT or the developer.':action==='proxy'?'Windows proxy settings opened. Review them with school IT, then retry.':'Browser opened. Check whether Ref OS loads there, then return here.';}
 catch(error){output.textContent=error.message||'Could not open troubleshooting option.';}
});
