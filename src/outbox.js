/* =====================================================================
   Durable write queue (IndexedDB).

   Violations (and any team they create) are written here the instant the
   ref hits Save, so a log made during a network dropout is never lost. The
   queue is flushed to Supabase on reconnect, on focus, and periodically.

   Dependency-free: a tiny IndexedDB key/value store holds one array per
   event under "outbox:<eventId>".
   ===================================================================== */
import * as api from "./api";

const DB_NAME = "vex-outbox";
const STORE = "kv";

function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function kvGet(key) {
  const d = await db();
  return new Promise((res, rej) => {
    const req = d.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = () => res(req.result || null);
    req.onerror = () => rej(req.error);
  });
}
async function kvSet(key, val) {
  const d = await db();
  return new Promise((res, rej) => {
    const req = d.transaction(STORE, "readwrite").objectStore(STORE).put(val, key);
    req.onsuccess = () => res(true);
    req.onerror = () => rej(req.error);
  });
}

const qKey = (eventId) => `outbox:${eventId}`;
export async function loadQueue(eventId) { return (await kvGet(qKey(eventId))) || []; }
async function saveQueue(eventId, q) { await kvSet(qKey(eventId), q); return q; }

export async function enqueue(eventId, op) {
  const q = await loadQueue(eventId);
  q.push(op);
  await saveQueue(eventId, q);
  return op;
}
export async function removeOp(eventId, opId) {
  const q = (await loadQueue(eventId)).filter((o) => o.id !== opId);
  await saveQueue(eventId, q);
  return q;
}

/* Treat "no network" as retryable; treat a real server rejection (RLS,
   validation) as permanent so one bad op can't wedge the queue forever. */
export function isOffline(e) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = (e && (e.message || String(e))) || "";
  return e instanceof TypeError || /failed to fetch|networkerror|network error|fetch|timeout|load failed/i.test(msg);
}

let flushing = false;
export async function flush(eventId, handlers = {}) {
  if (flushing) return;
  flushing = true;
  try {
    let q = await loadQueue(eventId);
    while (q.length) {
      const op = q[0];
      try {
        if (op.kind === "team") {
          await api.upsertTeam(op.eventId, op.number, op.name);
        } else if (op.kind === "violation") {
          const saved = await api.addViolationRow(op.eventId, op.row, op.photos || []);
          handlers.onSynced && handlers.onSynced(saved);
        }
        q = await removeOp(eventId, op.id);           // success -> drop it
      } catch (e) {
        if (isOffline(e)) break;                       // keep queued, retry later
        q = await removeOp(eventId, op.id);            // permanent -> drop so queue moves on
        handlers.onDropped && handlers.onDropped(op, e);
      }
    }
  } finally {
    flushing = false;
    handlers.onIdle && handlers.onIdle();
  }
}
