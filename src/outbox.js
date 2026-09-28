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
const failedKey = (eventId) => `failed:${eventId}`;
export async function loadQueue(eventId) { return (await kvGet(qKey(eventId))) || []; }
async function saveQueue(eventId, q) { await kvSet(qKey(eventId), q); return q; }
export async function loadFailed(eventId) { return (await kvGet(failedKey(eventId))) || []; }
async function saveFailed(eventId, items) { await kvSet(failedKey(eventId), items); return items; }
export async function discardFailed(eventId, failedId) {
  const items = (await loadFailed(eventId)).filter((item) => item.failedId !== failedId);
  return saveFailed(eventId, items);
}
export async function retryFailed(eventId, failedId) {
  const items = await loadFailed(eventId);
  const failed = items.find((item) => item.failedId === failedId);
  if (!failed) return false;
  await enqueue(eventId, failed.op);
  await saveFailed(eventId, items.filter((item) => item.failedId !== failedId));
  return true;
}
async function keepFailed(eventId, op, error) {
  const items = await loadFailed(eventId);
  const failedId = `${op.id}:failed:${Date.now()}`;
  items.unshift({
    failedId,
    op,
    message: error?.message || String(error || "Unknown sync error"),
    failedAt: Date.now(),
  });
  await saveFailed(eventId, items.slice(0, 100));
  return failedId;
}

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
const cancelledOps = new Set();
const cancelKey = (eventId, opId) => `${eventId}:${opId}`;

export async function cancelOp(eventId, opId) {
  cancelledOps.add(cancelKey(eventId, opId));
  return removeOp(eventId, opId);
}

export async function flush(eventId, handlers = {}) {
  if (flushing) return;
  flushing = true;
  try {
    let q = await loadQueue(eventId);
    while (q.length) {
      const op = q[0];
      const opCancelKey = cancelKey(eventId, op.id);
      if (cancelledOps.has(opCancelKey)) {
        q = await removeOp(eventId, op.id);
        cancelledOps.delete(opCancelKey);
        continue;
      }
      try {
        if (op.kind === "team") {
          await api.upsertTeam(op.eventId, op.number, op.name);
          handlers.onTeamSynced && handlers.onTeamSynced(op.number);
        } else if (op.kind === "violation") {
          const saved = await api.addViolationRow(op.eventId, op.row, op.photos || []);
          if (cancelledOps.has(opCancelKey)) await api.deleteViolation(saved);
          else handlers.onSynced && handlers.onSynced(saved);
        } else if (op.kind === "robot_photo") {
          const paths = await api.addTeamPhoto(op.eventId, op.number, op.dataUrl, op.angle, op.id, op.generation || "0");
          if (!paths) {
            handlers.onRobotPhotoDiscarded && handlers.onRobotPhotoDiscarded(op);
          } else if (cancelledOps.has(opCancelKey)) {
            await api.removeTeamPhoto(op.eventId, op.number, api.robotPhotoPath(op.eventId, op.number, op.angle, op.id, (String(op.dataUrl).match(/^data:([^;,]+)/) || [])[1]));
          } else {
            handlers.onRobotPhotoSynced && handlers.onRobotPhotoSynced(op, paths);
          }
        }
        q = await removeOp(eventId, op.id);           // success -> drop it
        cancelledOps.delete(opCancelKey);
      } catch (e) {
        if (isOffline(e)) break;                       // keep queued, retry later
        await keepFailed(eventId, op, e);              // permanent -> retain for recovery
        q = await removeOp(eventId, op.id);             // move queue forward
        handlers.onFailed && handlers.onFailed(op, e);
      }
    }
  } finally {
    flushing = false;
    handlers.onIdle && handlers.onIdle();
  }
}
