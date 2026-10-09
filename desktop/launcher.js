const input = document.querySelector('input'), button = document.querySelector('button'), status = document.querySelector('#status');
window.refosTmDesktop.savedWebsite().then(value => { input.value = value || ''; });
document.querySelector('form').addEventListener('submit', async event => {
  event.preventDefault(); button.disabled = true; status.textContent = 'Opening Ref OS…';
  try { await window.refosTmDesktop.openWebsite(input.value.trim()); }
  catch { status.textContent = 'Could not open Ref OS. Enter its HTTPS website address and check your internet connection.'; button.disabled = false; }
});
