import { normalizeTmAddress } from './tmAddress.js';
import { applyFieldEvent } from './tmFieldEvent.js';

export async function mobileSignedHeaders(url, path, key, token, date = new Date().toUTCString(), signer) {
  const message = `GET\n${path}\ntoken:${token}\nhost:${url.host}\nx-tm-date:${date}\n`;
  if (signer) return { Authorization: `Bearer ${token}`, 'x-tm-date': date, 'x-tm-signature': (await signer({ key, message })).signature };
  const encoder = new TextEncoder();
  const secret = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', secret, encoder.encode(message));
  return { Authorization: `Bearer ${token}`, 'x-tm-date': date, 'x-tm-signature': [...new Uint8Array(signature)].map(n => n.toString(16).padStart(2, '0')).join('') };
}

// Each client owns one event connection. Credentials and field state stay in memory.
export function createMobileTmClient({ http, sockets, cloudUrl, now = Date.now }) {
  let connectionId = '', identity = '', generation = 0, operation = 0, leaseUntil = 0, listener;
  const states = new Map(), retries = new Map(), attempts = new Map();
  const sign = (url, path, key, token) => mobileSignedHeaders(url, path, key, token, new Date(now()).toUTCString(), sockets.sign ? options => sockets.sign(options) : undefined);
  const close = async () => {
    generation++; connectionId = ''; identity = ''; leaseUntil = 0;
    for (const timer of retries.values()) clearTimeout(timer);
    retries.clear(); states.clear(); attempts.clear();
    const previousListener = listener; listener = undefined;
    if (previousListener) await previousListener.remove();
    await sockets.closeAll();
  };
  const configure = async (url, body, token, sets, snapshotOperation) => {
    const nextIdentity = JSON.stringify([body.eventId, url.origin, body.apiKey, body.division, token, sets]);
    if (identity === nextIdentity) { leaseUntil = now() + 90000; return; }
    await close();
    if (snapshotOperation !== operation) throw Error('TM connection cancelled.');
    identity = nextIdentity; connectionId = [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2, '0')).join(''); leaseUntil = now() + 90000;
    const ticket = generation;
    const connect = async id => {
      if (ticket !== generation) return;
      const state = states.get(id);
      state.connected = false;
      state.fields.forEach(f => { f.status = 'unknown'; f.match = null; f.active = false; });
      const path = `/api/fieldsets/${state.id}`, address = new URL(path, url);
      address.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      try {
        const headers = await sign(url, path, body.apiKey, token);
        if (ticket === generation) await sockets.open({ id, url: address.href, headers });
      } catch { retry(id); }
    };
    const retry = id => {
      if (ticket !== generation || retries.has(id)) return;
      const state = states.get(id); if (!state) return;
      state.connected = false;
      const count = attempts.get(id) || 0; attempts.set(id, count + 1);
      retries.set(id, setTimeout(() => { retries.delete(id); connect(id); }, Math.min(30000, 1000 * 2 ** Math.min(count, 5))));
    };
    listener = await sockets.addListener('socketEvent', event => {
      if (ticket !== generation) return;
      const state = states.get(event.id); if (!state) return;
      if (event.type === 'open') { state.connected = true; attempts.set(event.id, 0); }
      else if (event.type === 'message') { try { applyFieldEvent(state, JSON.parse(event.data), now()); } catch { /* Invalid TM messages do not change field state. */ } }
      else if (event.type === 'close' || event.type === 'error') retry(event.id);
    });
    if (snapshotOperation !== operation) { await close(); throw Error('TM connection cancelled.'); }
    for (const set of sets) {
      const id = `${ticket}:${set.id}`;
      states.set(id, { ...set, connected: false, fields: set.fields.map(f => ({ ...f, active: false, status: 'unknown', match: null })) });
      await connect(id);
    }
  };
  const json = result => typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
  return {
    async request(route, body) {
      if (route === 'disconnect') { if (!body.connectionId || !connectionId || body.connectionId === connectionId) { operation++; await close(); } return {}; }
      if (route === 'activity') {
        if (!connectionId || body.connectionId !== connectionId || now() > leaseUntil) { await close(); throw Error('TM live field connection expired. Reconnect TM.'); }
        return { fieldSets: [...states.values()].map(s => ({ ...s, fields: s.fields.map(f => ({ ...f })) })), checkedAt: now() };
      }
      if (route !== 'snapshot') throw Error('Unknown TM request.');
      const snapshotOperation = ++operation;
      const current = () => { if (snapshotOperation !== operation) throw Error('TM connection cancelled.'); };
      const url = new URL(normalizeTmAddress(body.address));
      if (!body.apiKey?.trim() || !body.authorization?.startsWith('Bearer ') || !body.anonKey) throw Error('Enter the event API key and sign in to Ref OS.');
      if (body.division != null && (!Number.isSafeInteger(body.division) || body.division < 1)) throw Error('Choose a TM division.');
      if (!cloudUrl?.startsWith('https://')) throw Error('Ref OS Cloud is not configured.');
      const authResult = await http({ url: `${cloudUrl}/functions/v1/tm-api-token`, method: 'POST', headers: { Authorization: body.authorization, apikey: body.anonKey, 'Content-Type': 'application/json' }, data: { eventId: body.eventId }, responseType: 'json', connectTimeout: 15000, readTimeout: 20000, disableRedirects: true });
      const auth = json(authResult);
      current();
      if (authResult.status !== 200 || typeof auth?.accessToken !== 'string') throw Error(auth?.error || 'TM authorization failed.');
      const get = async path => {
        const result = await http({ url: new URL(path, url).href, method: 'GET', headers: await sign(url, path, body.apiKey, auth.accessToken), responseType: 'json', connectTimeout: 15000, readTimeout: 20000, disableRedirects: true });
        current();
        if (result.status === 401 || result.status === 403) throw Error('TM rejected the event key or request signature. Check the key and device clock.');
        if (result.status !== 200) throw Error('Could not read TM data. Check the server address and event Wi-Fi.');
        return json(result);
      };
      const [event, divisions] = await Promise.all([get('/api/event'), get('/api/divisions')]);
      if (body.division == null) { await close(); return { event: event.event, divisions: divisions.divisions }; }
      if (!divisions.divisions?.some(d => d.id === body.division)) throw Error('This TM division no longer exists. Load the event again.');
      const [teams, matches, rankings, skills] = await Promise.all([get(`/api/teams/${body.division}`), get(`/api/matches/${body.division}`), get(`/api/rankings/${body.division}/QUAL`), get('/api/skills')]);
      let fieldError = '';
      if (body.liveFields) {
        try {
          const { fieldSets } = await get('/api/fieldsets');
          if (!Array.isArray(fieldSets) || fieldSets.length > 30) throw Error('Invalid field sets');
          const sets = await Promise.all(fieldSets.map(async set => {
            if (!Number.isSafeInteger(set.id) || set.id < 1) throw Error('Invalid field set');
            const { fields } = await get(`/api/fieldsets/${set.id}/fields`);
            if (!Array.isArray(fields) || fields.length > 30 || fields.some(f => !Number.isSafeInteger(f.id) || f.id < 1)) throw Error('Invalid fields');
            return { id: set.id, name: String(set.name || `Field set ${set.id}`), fields: fields.map(f => ({ id: f.id, name: String(f.name || `Field ${f.id}`) })) };
          }));
          current(); await configure(url, body, auth.accessToken, sets, snapshotOperation);
        } catch { current(); await close(); fieldError = 'Live fields could not connect. Scores and rankings can still sync.'; }
      } else await close();
      return { event: event.event, divisions: divisions.divisions, teams: teams.teams, matches: matches.matches, rankings: rankings.rankings, skills: skills.skillsRankings, connectionId, fieldError };
    },
    async close() { operation++; await close(); },
  };
}
