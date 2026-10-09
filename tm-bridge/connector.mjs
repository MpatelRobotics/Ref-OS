#!/usr/bin/env node
// Local, paired read-only TM connector. No developer secrets or database writes.
import { createServer } from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { tmAddress, createResourceReader } from './protocol.mjs';
import { LiveFieldStreams } from './live-fields.mjs';

export function createConnector({ origin, pairingCode, cloudUrl = 'https://gcibsphjcllspzesqqsw.supabase.co', fetcher = fetch }) {
  const read = createResourceReader({ fetcher });
  const live = new LiveFieldStreams();
  let connectionId = '', connectionKey = '', leaseUntil = 0;
  const expiry = setInterval(() => { if (connectionId && Date.now() > leaseUntil) { live.close(); connectionId = ''; connectionKey = ''; } }, 10000);
  expiry.unref();
  const server = createServer(async (request, response) => {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
    if (request.headers.origin !== origin) { response.writeHead(403, headers); response.end(JSON.stringify({ error: 'Open the Ref OS address used to start this connector.' })); return; }
    Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, x-refos-pairing', 'Access-Control-Allow-Private-Network': 'true' });
    const reply = (body, status = 200) => { response.writeHead(status, headers); response.end(JSON.stringify(body)); };
    if (request.method === 'OPTIONS') { reply({}); return; }
    if (request.method !== 'POST' || !['/snapshot', '/activity', '/disconnect'].includes(request.url)) { reply({ error: 'Unknown connector request.' }, 404); return; }
    const supplied = Buffer.from(String(request.headers['x-refos-pairing'] || ''));
    const expected = Buffer.from(pairingCode);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) { reply({ error: 'The connector pairing code is incorrect.' }, 403); return; }
    try {
      let raw = '';
      for await (const chunk of request) { raw += chunk; if (raw.length > 20000) { reply({ error: 'Request too large.' }, 413); return; } }
      const body = JSON.parse(raw);
      if (request.url !== '/snapshot') {
        if (!connectionId || body.connectionId !== connectionId || Date.now() > leaseUntil) { reply({ error: 'TM live field connection expired. Reconnect TM.' }, 409); return; }
        if (request.url === '/disconnect') { live.close(); connectionId = ''; connectionKey = ''; reply({}); return; }
        reply({ fieldSets: live.snapshot(), checkedAt: Date.now() }); return;
      }
      const url = tmAddress(body.address);
      if (typeof body.apiKey !== 'string' || !body.apiKey.trim() || body.apiKey.length > 2000 || typeof body.authorization !== 'string' || !body.authorization.startsWith('Bearer ') || typeof body.anonKey !== 'string') throw new Error('Enter the event API key and sign in to Ref OS.');
      if (body.division != null && (!Number.isSafeInteger(body.division) || body.division < 1)) throw new Error('Choose a TM division.');
      // Ref OS's backend checks the current user's admin role every snapshot.
      const authorized = await fetcher(`${cloudUrl}/functions/v1/tm-api-token`, {
        method: 'POST', signal: AbortSignal.timeout(20000),
        headers: { Authorization: body.authorization, apikey: body.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: body.eventId }),
      });
      const auth = await authorized.json();
      if (!authorized.ok || typeof auth.accessToken !== 'string') throw new Error(auth.error || 'TM authorization failed.');
      const get = path => read(url, path, body.apiKey, auth.accessToken, body.forceScores === true && [`/api/matches/${body.division}`, `/api/rankings/${body.division}/QUAL`].includes(path));
      const [event, divisions] = await Promise.all([get('/api/event'), get('/api/divisions')]);
      if (body.division == null) { reply({ event: event.event, divisions: divisions.divisions }); return; }
      if (!divisions.divisions?.some(row => row.id === body.division)) throw new Error('This TM division no longer exists. Load the event again.');
      const [teams, matches, rankings, skills] = await Promise.all([
        get(`/api/teams/${body.division}`), get(`/api/matches/${body.division}`), get(`/api/rankings/${body.division}/QUAL`), get('/api/skills'),
      ]);
      let fieldError = '';
      if (body.liveFields === true) {
        try {
          const fieldSets = await get('/api/fieldsets');
          if (!Array.isArray(fieldSets.fieldSets) || fieldSets.fieldSets.length > 30) throw Error('TM returned invalid field sets.');
          const sets = await Promise.all(fieldSets.fieldSets.map(async set => {
            if (!Number.isSafeInteger(set.id) || set.id < 1) throw Error('TM returned invalid field sets.');
            const fields = await get(`/api/fieldsets/${set.id}/fields`);
            if (!Array.isArray(fields.fields) || fields.fields.length > 30 || fields.fields.some(f => !Number.isSafeInteger(f.id) || f.id < 1)) throw Error('TM returned invalid fields.');
            return { id: set.id, name: String(set.name || `Field set ${set.id}`), fields: fields.fields.map(f => ({ id: f.id, name: String(f.name || `Field ${f.id}`) })) };
          }));
          const identity = createHash('sha256').update(`${body.eventId}\n${url.origin}\n${body.apiKey}\n${body.division}`).digest('hex');
          if (connectionKey !== identity) { live.close(); connectionId = randomUUID(); connectionKey = identity; }
          live.configure(url, body.apiKey, auth.accessToken, sets);
          leaseUntil = Date.now() + 90000;
        } catch { live.close(); connectionId = ''; connectionKey = ''; fieldError = 'Live fields could not connect. Check that TM supports the field API; rankings and score sync can continue.'; }
      } else { live.close(); connectionId = ''; connectionKey = ''; }
      reply({ event: event.event, divisions: divisions.divisions, teams: teams.teams, matches: matches.matches, rankings: rankings.rankings, skills: skills.skillsRankings, connectionId, fieldError });
    } catch (error) {
      const message = error instanceof Error && /^(TM |Enter |Use |Choose |This TM|Event administrator|Sign in|Too many)/.test(error.message) ? error.message : 'Could not reach TM or authorize the connector. Check the address, local network, and internet connection.';
      reply({ error: message }, 502);
    }
  });
  server.on('close', () => { clearInterval(expiry); live.close(); });
  return server;
}

