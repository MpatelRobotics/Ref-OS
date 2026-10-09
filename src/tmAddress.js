export function normalizeTmAddress(value) {
  const entered = String(value ?? '').trim();
  if (!entered) throw Error('Enter the TM server IP address or hostname.');
  const address = /^[a-z][a-z\d+.-]*:\/\//i.test(entered) ? entered : `http://${entered}`;
  let url;
  try { url = new URL(address); } catch { throw Error('Enter a valid TM server IP address or hostname, with its port if needed.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error('Use only the TM server address and optional port.');
  return url.origin;
}
