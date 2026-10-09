import WebSocket from 'ws';
import { signedHeaders } from './protocol.mjs';

const positive = n => Number.isSafeInteger(n) && n > 0;
const nonnegative = n => Number.isSafeInteger(n) && n >= 0;
export function applyFieldEvent(set, message, now = Date.now()) {
  if (!message || typeof message !== 'object') return false;
  if (message.type === 'audienceDisplayChanged') {
    if (typeof message.display !== 'string' || message.display.length > 100) return false;
    set.display = message.display; return true;
  }
  const field = set.fields.find(row => row.id === message.fieldID);
  if (!field) return false;
  if (message.type === 'fieldMatchAssigned') {
    const m = message.match;
    if (!m || !positive(m.division) || !nonnegative(m.session) || !positive(m.match) || !positive(m.instance) || typeof m.round !== 'string' || m.round.length > 30) return false;
    field.match = { division: m.division, session: m.session, round: m.round, match: m.match, instance: m.instance };
    field.status = 'queued';
  } else if (message.type === 'fieldActivated') {
    for (const row of set.fields) row.active = row === field;
  } else if (message.type === 'matchStarted') field.status = 'playing';
  else if (message.type === 'matchStopped') field.status = 'stopped';
  else return false;
  field.observedAt = now; return true;
}

export class LiveFieldStreams {
  constructor({ Socket = WebSocket } = {}) { this.Socket = Socket; this.sets = new Map(); this.generation = 0; this.credentials = ''; }
  configure(url, key, bearer, sets) {
    const identity = `${url.origin}\n${key}\n${bearer}\n${JSON.stringify(sets)}`;
    if (this.credentials === identity) return;
    this.close(); this.credentials = identity;
    const generation = this.generation;
    for (const item of sets) {
      const state = { id: item.id, name: item.name, connected: false, fields: item.fields.map(f => ({ id: f.id, name: f.name, active: false, status: 'unknown', match: null })) };
      this.sets.set(item.id, state);
      let attempts = 0;
      const connect = () => {
        if (generation !== this.generation) return;
        state.connected = false;
        for (const field of state.fields) { field.status = 'unknown'; field.active = false; }
        const path = `/api/fieldsets/${item.id}`, address = new URL(path, url);
        address.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new this.Socket(address, { headers: signedHeaders(url, path, key, bearer), handshakeTimeout: 15000, maxPayload: 65536, perMessageDeflate: false, followRedirects: false });
        state.socket = socket;
        let pongAt = Date.now();
        socket.on('open', () => { if (generation === this.generation) { state.connected = true; attempts = 0; pongAt = Date.now(); } });
        socket.on('message', (raw, binary) => {
          if (generation !== this.generation || binary) return;
          try { applyFieldEvent(state, JSON.parse(String(raw))); } catch { /* Ignore malformed or unsupported messages. */ }
        });
        socket.on('pong', () => { pongAt = Date.now(); });
        const heartbeat = setInterval(() => {
          if (socket.readyState !== 1) return;
          if (Date.now() - pongAt > 45000) socket.terminate(); else socket.ping();
        }, 30000);
        heartbeat.unref(); state.heartbeat = heartbeat;
        socket.on('error', () => { state.connected = false; });
        socket.on('close', () => {
          clearInterval(heartbeat); state.connected = false;
          if (generation !== this.generation) return;
          state.retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)));
          state.retry.unref();
        });
      };
      connect();
    }
  }
  snapshot() {
    return [...this.sets.values()].map(({ id, name, connected, fields, display }) => ({ id, name, connected, fields, ...(display ? { display } : {}) }));
  }
  close() {
    this.generation++; this.credentials = '';
    for (const set of this.sets.values()) { clearTimeout(set.retry); clearInterval(set.heartbeat); set.socket?.terminate(); }
    this.sets.clear();
  }
}
