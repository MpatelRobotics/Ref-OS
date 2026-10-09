import { createHmac } from 'node:crypto';
import { normalizeTmAddress } from '../src/tmAddress.js';
export function tmAddress(value) {
  return new URL(normalizeTmAddress(value));
}
export function signedHeaders(url, path, apiKey, bearer, date = new Date().toUTCString()) {
  const message = `GET\n${path}\ntoken:${bearer}\nhost:${url.host}\nx-tm-date:${date}\n`;
  return { Host: url.host, Authorization: `Bearer ${bearer}`, 'x-tm-date': date, 'x-tm-signature': createHmac('sha256', apiKey).update(message).digest('hex') };
}
export function createResourceReader({ fetcher = fetch, now = Date.now } = {}) {
  const cache = new Map(), pending = new Map();
  return async function read(url, path, apiKey, bearer) {
    const key = `${url.origin}|${createHmac('sha256', apiKey).update(path).digest('hex')}`;
    const old = cache.get(key);
    if (old && now() - old.checkedAt < 60000) return old.data;
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      const headers = signedHeaders(url, path, apiKey, bearer);
      if (old?.modified) headers['If-Modified-Since'] = old.modified;
      const response = await fetcher(new URL(path, url), { headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (response.status === 304 && old) { old.checkedAt = now(); return old.data; }
      if (!response.ok) throw new Error(`TM could not read ${path} (HTTP ${response.status}). Check the event key, address, and computer clock.`);
      const raw = await response.text();
      if (raw.length > 2000000) throw new Error('TM response is too large.');
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error('TM returned an invalid response.'); }
      if (cache.size >= 50) cache.delete(cache.keys().next().value);
      cache.set(key, { data, modified: response.headers.get('last-modified'), checkedAt: now() });
      return data;
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  };
}
