const input = document.querySelector('input'), button = document.querySelector('button'), status = document.querySelector('#status');
window.refosTmDesktop.connectionError().then(message => { if (message) status.textContent = message; });
window.refosTmDesktop.savedWebsite().then(value => { input.value = value || ''; });
document.querySelector('form').addEventListener('submit', async event => {
  event.preventDefault(); button.disabled = true; status.textContent = 'Opening Ref OS…';
  try { await window.refosTmDesktop.openWebsite(input.value.trim()); }
  catch (error) { status.textContent = error.message || 'Could not open Ref OS. Check your website address and internet connection.'; button.disabled = false; }
});
