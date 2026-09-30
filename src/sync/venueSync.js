// Ref OS Local Venue Server sync (Phase 1).
//
// Holds, per event, on THIS device (IndexedDB "refos-venue"):
//   mirror   the server-confirmed records and the pull cursor
//   pending  local changes not yet accepted by the server (never discarded silently)
//   rejected changes the server refused as invalid (kept for export/recovery)
// Reads return mirror + pending, so a write shows immediately and survives refreshes and
// server outages. Writes are pushed to the server as soon as it is reachable; other devices'
// changes are pulled every few seconds.
import { supabase } from "../supabaseClient";
import { getSyncConfig, isVenueMode, deviceId, uuid, onSyncConfigChange } from "./syncConfig";

const DB_NAME = "refos-venue";
const STORE = "kv";
const POLL_MS = 3000;
const BACKOFF_MS = 10000;
const REQUEST_TIMEOUT_MS = 8000;
const PUSH_BATCH = 50;
const COALESCE_KINDS = new Set(["presence", "roster"]);

/* ---------------- IndexedDB key/value ---------------- */
let dbPromise = null;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbPromise;
}
async function kvGet(key) {
  const d = await db();
  return new Promise((res, rej) => {
    const req = d.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror = () => rej(req.error);
  });
}
async function kvSet(key, value) {
  const d = await db();
  return new Promise((res, rej) => {
    const req = d.transaction(STORE, "readwrite").objectStore(STORE).put(value, key);
    req.onsuccess = () => res(true);
    req.onerror = () => rej(req.error);
  });
}

/* ---------------- per-event state ---------------- */
const events = new Map(); // eventId -> state
let activeEventId = null;
let deviceLabel = "";
const statusListeners = new Set();

const recordKey = (kind, recordId) => `${kind}:${recordId}`;

function blankStatus() {
  return { state: "idle", connected: null, latencyMs: null, lastSuccessAt: 0, lastError: "", paired: false, keyAvailable: null };
}

async function loadState(eventId) {
  if (events.has(eventId)) return events.get(eventId);
  const st = {
    eventId, loaded: null, mirror: { cursor: 0, records: {} }, pending: [], rejected: [], cloud: {},
    listeners: new Set(), status: blankStatus(), timer: null, running: false, syncing: null, lastNotify: 0, notifyTimer: null,
  };
  events.set(eventId, st);
  st.loaded = (async () => {
    const [mirror, pending, rejected, cloud] = await Promise.all([
      kvGet(`mirror:${eventId}`), kvGet(`pending:${eventId}`), kvGet(`rejected:${eventId}`), kvGet(`cloud:${eventId}`),
    ]);
    // Mirror data belongs to one server; a different server starts from its own cursor.
    const serverUrl = getSyncConfig().serverUrl;
    if (mirror && mirror.serverUrl === serverUrl) st.mirror = mirror;
    else if (mirror) st.mirror = { cursor: 0, records: mirror.records || {}, serverUrl };
    st.mirror.serverUrl = serverUrl;
    st.pending = Array.isArray(pending) ? pending : [];
    st.rejected = Array.isArray(rejected) ? rejected : [];
    st.cloud = cloud || {};
  })();
  await st.loaded;
  return st;
}
const saveMirror = (st) => kvSet(`mirror:${st.eventId}`, st.mirror);
const savePending = (st) => kvSet(`pending:${st.eventId}`, st.pending);
const saveRejected = (st) => kvSet(`rejected:${st.eventId}`, st.rejected);

function emitStatus(st) {
  if (st.eventId !== activeEventId) return;
  const snapshot = getStatus();
  statusListeners.forEach((fn) => { try { fn(snapshot); } catch {} });
}
function setStatus(st, patch) {
  st.status = { ...st.status, ...patch };
  emitStatus(st);
}

// Throttled change notification so a burst of pulled changes causes one UI refresh.
function notify(st) {
  const fire = () => { st.lastNotify = Date.now(); st.notifyTimer = null; st.listeners.forEach((fn) => { try { fn(); } catch {} }); };
  if (st.notifyTimer) return;
  const wait = Math.max(0, 1200 - (Date.now() - st.lastNotify));
  st.notifyTimer = setTimeout(fire, wait);
}

/* ---------------- venue sync key (issued by Supabase to signed-in members) ---------------- */
const keyCacheName = (eventId) => `refosVenueKey:${eventId}`;
async function venueKey(eventId, { allowFetch = true } = {}) {
  try {
    const cached = localStorage.getItem(keyCacheName(eventId));
    if (cached && /^[0-9a-f]{64}$/.test(cached)) return cached;
  } catch {}
  if (!allowFetch) return null;
  const { data, error } = await supabase.rpc("get_venue_sync_key", { p_event: eventId });
  if (error || !/^[0-9a-f]{64}$/.test(String(data || ""))) {
    const err = new Error(error?.message?.includes("get_venue_sync_key")
      ? "Venue sync is not installed in Supabase yet (run refos-2-venue-sync.sql)."
      : "This device needs one online sign-in to this event before it can use the venue server.");
    err.keyUnavailable = true;
    throw err;
  }
  try { localStorage.setItem(keyCacheName(eventId), data); } catch {}
  return data;
}
export const forgetVenueKey = (eventId) => { try { localStorage.removeItem(keyCacheName(eventId)); } catch {} };

// Re-read the key from Supabase when the internet is available (e.g. after an Admin rotated it).
// The cached key is replaced only when Supabase returns a valid key, so a device that has no
// internet keeps working with the key it has.
async function refreshVenueKey(st) {
  try {
    const result = await Promise.race([
      supabase.rpc("get_venue_sync_key", { p_event: st.eventId }),
      new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
    const fresh = String(result?.data || "");
    if (result?.error || !/^[0-9a-f]{64}$/.test(fresh)) return false;
    let cached = null;
    try { cached = localStorage.getItem(keyCacheName(st.eventId)); } catch {}
    if (cached === fresh) return false;
    try { localStorage.setItem(keyCacheName(st.eventId), fresh); } catch {}
    setStatus(st, { paired: false });
    return true;
  } catch {
    return false;
  }
}

/* ---------------- HTTP ---------------- */
class VenueUnreachableError extends TypeError {
  constructor(message) { super(message || "Venue server unreachable (Failed to fetch)"); this.venueUnreachable = true; }
}

async function request(path, { method = "GET", body, key } = {}) {
  const base = getSyncConfig().serverUrl.replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = { "X-Refos-Device": deviceId() };
  if (deviceLabel) headers["X-Refos-Device-Label"] = encodeURIComponent(deviceLabel.slice(0, 80));
  if (key) headers.Authorization = `Bearer ${key}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const started = performance.now();
  let response;
  try {
    response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal, cache: "no-store" });
  } catch (error) {
    throw new VenueUnreachableError(error?.name === "AbortError" ? "Venue server did not respond (timeout)" : undefined);
  } finally {
    clearTimeout(timer);
  }
  const latencyMs = Math.round(performance.now() - started);
  let json = null;
  try { json = await response.json(); } catch {}
  if (!response.ok) {
    const err = new Error(json?.error || `Venue server error ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return { json, latencyMs };
}

// GET /api/v1/health — used by Test Connection. Never sends the event key.
export async function testConnection(serverUrl) {
  const base = String(serverUrl || getSyncConfig().serverUrl).replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  const started = performance.now();
  try {
    const response = await fetch(`${base}/api/v1/health`, { signal: controller.signal, cache: "no-store" });
    const latencyMs = Math.round(performance.now() - started);
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.service !== "refos-venue-server") return { ok: false, latencyMs, error: "That address is not a Ref OS Venue Server." };
    return { ok: true, latencyMs, version: body.version, apiVersion: body.apiVersion, serverTime: body.serverTime };
  } catch (error) {
    return { ok: false, latencyMs: null, error: error?.name === "AbortError" ? "No response from the venue server." : "Could not reach the venue server." };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- sync cycle ---------------- */
async function ensurePaired(st, key) {
  if (st.status.paired) return;
  await request(`/api/v1/events/${st.eventId}/register`, { method: "POST", key, body: {} });
  setStatus(st, { paired: true });
}

async function push(st, key) {
  while (st.pending.length) {
    const batch = st.pending.slice(0, PUSH_BATCH);
    const { json, latencyMs } = await request(`/api/v1/events/${st.eventId}/changes`, { method: "POST", key, body: { changes: batch } });
    setStatus(st, { latencyMs });
    const results = new Map((json?.results || []).map((r) => [r.changeId, r]));
    const accepted = new Set();
    const newlyRejected = [];
    for (const change of batch) {
      const result = results.get(change.changeId);
      if (!result) continue; // keep and retry
      if (result.status === "invalid") newlyRejected.push({ change, error: result.error || "invalid", at: Date.now() });
      accepted.add(change.changeId);
    }
    if (!accepted.size) throw new Error("Venue server did not accept any queued change.");
    st.pending = st.pending.filter((c) => !accepted.has(c.changeId));
    await savePending(st);
    if (newlyRejected.length) {
      st.rejected = [...newlyRejected, ...st.rejected].slice(0, 500);
      await saveRejected(st);
    }
  }
}

async function pull(st, key) {
  let changed = false;
  for (let guard = 0; guard < 50; guard++) {
    const { json, latencyMs } = await request(`/api/v1/events/${st.eventId}/changes?since=${st.mirror.cursor}&limit=500`, { key });
    setStatus(st, { latencyMs });
    for (const c of json?.changes || []) {
      const k = recordKey(c.kind, c.recordId);
      const prev = st.mirror.records[k];
      if (c.op === "delete") st.mirror.records[k] = { kind: c.kind, recordId: c.recordId, data: prev?.data || null, deleted: true, version: c.version };
      else st.mirror.records[k] = { kind: c.kind, recordId: c.recordId, data: c.data, deleted: false, version: c.version };
      changed = true;
    }
    st.mirror.cursor = Math.max(st.mirror.cursor, Number(json?.nextSince || 0));
    if (!json?.hasMore) break;
  }
  if (changed) await saveMirror(st);
  return changed;
}

async function syncOnce(st) {
  if (!isVenueMode()) return;
  if (st.syncing) return st.syncing;
  st.syncing = (async () => {
    setStatus(st, { state: "syncing" });
    try {
      const key = await venueKey(st.eventId);
      setStatus(st, { keyAvailable: true });
      await ensurePaired(st, key);
      await push(st, key);
      const changed = await pull(st, key);
      setStatus(st, { state: "idle", connected: true, lastSuccessAt: Date.now(), lastError: "" });
      if (changed) notify(st);
      return true;
    } catch (error) {
      if (error.keyUnavailable) setStatus(st, { state: "error", keyAvailable: false, lastError: error.message });
      else if (error.venueUnreachable) setStatus(st, { state: "offline", connected: false, lastError: error.message });
      else {
        setStatus(st, { state: "error", connected: error.status ? true : st.status.connected, lastError: error.message, paired: error.status === 401 || error.status === 409 ? false : st.status.paired });
        // 409: the server is paired with a different key for this event (the key was rotated).
        if (error.status === 409) refreshVenueKey(st);
      }
      return false;
    } finally {
      st.syncing = null;
      emitStatus(st);
    }
  })();
  return st.syncing;
}

function schedule(st, delay) {
  clearTimeout(st.timer);
  if (!st.running) return;
  st.timer = setTimeout(async () => {
    const ok = await syncOnce(st);
    schedule(st, ok ? POLL_MS : BACKOFF_MS);
  }, delay);
}

// A different server or mode starts clean in memory (nothing stored on the device is deleted).
let lastConfig = getSyncConfig();
onSyncConfigChange((cfg) => {
  if (cfg.mode !== lastConfig.mode || cfg.serverUrl !== lastConfig.serverUrl) {
    for (const st of events.values()) { st.running = false; clearTimeout(st.timer); }
    events.clear();
    const eventId = activeEventId;
    lastConfig = cfg;
    if (eventId && cfg.mode === "venue") activate(eventId);
    else statusListeners.forEach((fn) => { try { fn(getStatus()); } catch {} });
  }
  lastConfig = cfg;
});

/* ---------------- public API ---------------- */
export const isActive = () => isVenueMode();
export const currentEventId = () => activeEventId;
export function setDeviceLabel(label) { deviceLabel = String(label || "").slice(0, 80); }

// Start syncing an event (idempotent). Stops any other event's loop.
export async function activate(eventId) {
  if (!eventId) return null;
  if (activeEventId && activeEventId !== eventId) {
    const other = events.get(activeEventId);
    if (other) { other.running = false; clearTimeout(other.timer); }
  }
  activeEventId = eventId;
  const st = await loadState(eventId);
  if (!st.running && isVenueMode()) {
    st.running = true;
    schedule(st, 0);
    if (!st.keyChecked) { st.keyChecked = true; refreshVenueKey(st); }
  }
  emitStatus(st);
  return st;
}
export function deactivateAll() {
  for (const st of events.values()) { st.running = false; clearTimeout(st.timer); }
}

function view(st, kind) {
  const map = new Map();
  for (const rec of Object.values(st.mirror.records)) if (rec.kind === kind) map.set(rec.recordId, { ...rec });
  for (const c of st.pending) {
    if (c.kind !== kind) continue;
    if (c.op === "delete") { const prev = map.get(c.recordId); map.set(c.recordId, { kind, recordId: c.recordId, data: prev?.data || null, deleted: true, version: prev?.version || 0, pending: true }); }
    else map.set(c.recordId, { kind, recordId: c.recordId, data: c.data, deleted: false, version: map.get(c.recordId)?.version || 0, pending: true });
  }
  return map;
}

// Live records of a kind (deleted ones excluded), plus the ids deleted on the venue.
export async function list(eventId, kind) {
  const st = await activate(eventId);
  const map = view(st, kind);
  const live = [];
  const deletedIds = new Set();
  for (const rec of map.values()) { if (rec.deleted) deletedIds.add(rec.recordId); else live.push(rec); }
  return { records: live, deletedIds };
}

export async function get(eventId, kind, recordId) {
  const st = await activate(eventId);
  return view(st, kind).get(recordId) || null;
}

// Queue a change locally (durable) and push it as soon as possible.
export async function write(eventId, kind, recordId, op, data = null) {
  const st = await activate(eventId);
  const current = view(st, kind).get(recordId);
  const change = { changeId: uuid(), kind, recordId: String(recordId), op, clientTs: Date.now() };
  if (current?.version) change.baseVersion = current.version;
  if (op === "upsert") change.data = data;
  if (COALESCE_KINDS.has(kind)) st.pending = st.pending.filter((c) => !(c.kind === kind && c.recordId === change.recordId));
  st.pending.push(change);
  await savePending(st);
  emitStatus(st);
  notify(st);
  if (st.running) schedule(st, 0);
  return change;
}

export function subscribe(eventId, fn) {
  let st = events.get(eventId);
  let cancelled = false;
  const attach = (state) => { if (!cancelled) state.listeners.add(fn); };
  if (st) attach(st);
  else activate(eventId).then(attach);
  return () => { cancelled = true; events.get(eventId)?.listeners.delete(fn); };
}

// Last successful cloud reads, so cloud records stay visible in venue mode when the internet drops.
export async function saveCloudSnapshot(eventId, kind, rows) {
  const st = await loadState(eventId);
  st.cloud = { ...st.cloud, [kind]: rows };
  await kvSet(`cloud:${eventId}`, st.cloud);
}
export async function cloudSnapshot(eventId, kind) {
  const st = await loadState(eventId);
  return st.cloud?.[kind] || [];
}

export async function syncNow(eventId = activeEventId) {
  if (!eventId) return false;
  const st = await activate(eventId);
  const ok = await syncOnce(st);
  if (st.running) schedule(st, ok ? POLL_MS : BACKOFF_MS);
  return ok;
}

export function getStatus() {
  const cfg = getSyncConfig();
  const st = activeEventId ? events.get(activeEventId) : null;
  return {
    mode: cfg.mode, serverUrl: cfg.serverUrl, source: cfg.source, eventId: activeEventId,
    ...(st ? st.status : blankStatus()),
    pending: st ? st.pending.length : 0,
    rejected: st ? st.rejected.length : 0,
    localRecords: st ? Object.values(st.mirror.records).filter((r) => !r.deleted && r.kind !== "presence").length : 0,
  };
}
export function onStatus(fn) {
  statusListeners.add(fn);
  fn(getStatus());
  return () => statusListeners.delete(fn);
}

// Export Venue Data: the server's copy when reachable, otherwise this device's copy.
// Never includes the venue sync key or any credential.
export async function exportVenueData(eventId = activeEventId) {
  const st = await activate(eventId);
  const devicePart = {
    deviceId: deviceId(),
    pendingChanges: st.pending,
    rejectedChanges: st.rejected,
  };
  try {
    const key = await venueKey(eventId, { allowFetch: false });
    if (!key) throw new VenueUnreachableError("No venue key on this device");
    const { json } = await request(`/api/v1/events/${eventId}/export`, { key });
    return { source: "venue-server", data: { ...json, thisDevice: devicePart } };
  } catch (error) {
    const records = Object.values(st.mirror.records).filter((r) => r.kind !== "presence");
    return {
      source: "this-device",
      error: error?.message || "",
      data: {
        format: "refos-venue-device-export", formatVersion: 1, exportedAt: new Date().toISOString(), eventId,
        reconciledToCloud: false,
        note: "The venue server could not be reached, so this is this device's copy (server-confirmed records plus this device's unsent changes).",
        records, thisDevice: devicePart,
      },
    };
  }
}

// True when this device holds venue data that has not been exported or reconciled; used to warn
// before switching back to Cloud. Nothing is deleted when switching modes.
export async function localVenueSummary(eventId = activeEventId) {
  if (!eventId) return { pending: 0, records: 0 };
  const st = await loadState(eventId);
  return { pending: st.pending.length, records: Object.values(st.mirror.records).filter((r) => !r.deleted && r.kind !== "presence").length };
}

export const _test = { events, request, VenueUnreachableError, view };
