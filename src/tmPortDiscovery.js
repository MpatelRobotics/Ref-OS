import { normalizeTmAddress } from './tmAddress.js';

// Probe only the entered IPv4 host, never the surrounding network. Explicit
// schemes and ports are authoritative, including explicit default ports.
export function tmPortCandidates(value) {
  const entered = String(value ?? '').trim();
  const normalized = normalizeTmAddress(entered);
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(entered)) return [normalized];
  const host = new URL(normalized).hostname;
  return [`http://${host}`, `http://${host}:8080`, `https://${host}`, `https://${host}:8443`];
}

export function createTmPortDiscovery() {
  const resolved = new Map();
  return async (body, request) => {
    const candidates = tmPortCandidates(body.address);
    if (candidates.length === 1) return request({ ...body, address: candidates[0] });
    const key = JSON.stringify([body.eventId, body.channelId || 'default', body.address]);
    // Pin the selected server for later snapshots; never silently switch a
    // running sync to a different service when its connection fails.
    if (resolved.has(key)) {
      const address = resolved.get(key);
      return { ...await request({ ...body, address }), detectedAddress: address };
    }
    let lastError;
    for (const address of candidates) {
      let header;
      try {
        header = await request({ ...body, address, division: null, liveFields: false });
        if (typeof header?.event?.name !== 'string' || !Array.isArray(header.divisions) || !header.divisions.length || header.divisions.some(d => !Number.isSafeInteger(d.id) || d.id < 1 || typeof d.name !== 'string')) throw Error('The server did not return valid TM event data.');
      } catch (error) {
        if (/rejected|signature|authorization|administrator|sign in|event key|cancelled/i.test(error.message) && !/Could not reach TM or authorize/i.test(error.message)) throw error;
        lastError = error;
        continue;
      }
      if (resolved.size >= 30) resolved.delete(resolved.keys().next().value);
      resolved.set(key, address);
      const result = body.division == null ? header : await request({ ...body, address });
      return { ...result, detectedAddress: address };
    }
    throw Error(`Could not find TM on ports 80, 8080, 443 or 8443. Check the IP and event network, or enter IP:port for a custom port. ${lastError?.message || ''}`);
  };
}
