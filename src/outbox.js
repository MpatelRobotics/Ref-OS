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
    req.onsuccess = () => { const value = req.result || null; d.close(); res(value); };
    req.onerror = () => { d.close(); rej(req.error); };
  });
}
// Read/modify/write stays inside one transaction. IndexedDB serializes these
// transactions across connections and tabs, preventing lost concurrent saves.
async function mutate(keys, change) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, "readwrite"), store = tx.objectStore(STORE);
    const values = {}; let remaining = keys.length, result;
    tx.oncomplete = () => { d.close(); resolve(result); };
    tx.onabort = tx.onerror = () => { d.close(); reject(tx.error || new Error("Local save failed")); };
    for (const key of keys) {
      const request = store.get(key);
      request.onsuccess = () => {
        values[key] = request.result;
        if (--remaining) return;
        try {
          result = change(values);
          for (const name of keys) store.put(values[name], name);
        } catch (error) { tx.abort(); reject(error); }
      };
    }
  });
}
async function kvSet(key, val) { return mutate([key], values => { values[key] = val; return true; }); }
const qKey = eventId => `outbox:${eventId}`;
const failedKey = eventId => `failed:${eventId}`;
export async function loadQueue(eventId) { return (await kvGet(qKey(eventId))) || []; }
export async function saveEventSnapshot(event,session,division,value){return kvSet(`eventSnapshot:${event}:${session||''}:${division}`,value);}
export async function loadEventSnapshot(event,session,division){return kvGet(`eventSnapshot:${event}:${session||''}:${division}`);}
export async function loadFailed(eventId) { return (await kvGet(failedKey(eventId))) || []; }
export async function discardFailed(eventId, failedId) {
  const key = failedKey(eventId);
  return mutate([key], values => values[key] = (values[key] || []).filter(item => item.failedId !== failedId));
}
export async function retryFailed(eventId, failedId) {
  const q = qKey(eventId), f = failedKey(eventId);
  return mutate([q,f], values => {
    const items = values[f] || [], failed = items.find(item => item.failedId === failedId);
    if (!failed) { values[q] ||= []; values[f] = items; return false; }
    values[q] = [...(values[q] || []).filter(item => item.id !== failed.op.id), failed.op];
    values[f] = items.filter(item => item.failedId !== failedId);
    return true;
  });
}
async function keepFailed(eventId, op, error) {
  const key = failedKey(eventId), failedId = `${op.id}:failed:${Date.now()}`;
  return mutate([key], values => {
    values[key] = [{failedId, op, message:error?.message || String(error || "Unknown sync error"), failedAt:Date.now()}, ...(values[key] || []).filter(item => item.op.id !== op.id)];
    return failedId;
  });
}
export async function enqueue(eventId, op) {
  const key = qKey(eventId);
  return mutate([key], values => {
    values[key] = [...(values[key] || []).filter(item => item.id !== op.id), op];
    return op;
  });
}
export async function removeOp(eventId, opId) {
  const key = qKey(eventId);
  return mutate([key], values => values[key] = (values[key] || []).filter(item => item.id !== opId));
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
          // A violation queued without a league session (made while the event was a Tournament,
          // or by a device that had not yet seen it become a League) is placed in the converted
          // League's first session only when that is certain; otherwise it is held for review.
          let row = op.row;
          if (!row.session_id) {
            const target = await api.queuedRecordSession(op.eventId, op.createdAt);
            if (target.hold) throw new Error(target.hold);
            if (target.sessionId) row = { ...row, session_id: target.sessionId };
          }
          const saved = await api.addViolationRow(op.eventId, row, op.photos || []);
          if (cancelledOps.has(opCancelKey)) await api.deleteViolation(saved);
          else handlers.onSynced && handlers.onSynced(saved);
        } else if (op.kind === "robot_photo") {
          // op.sessionId: the league session the photo was taken in (absent for tournaments).
          let photoSession = op.sessionId;
          if (photoSession === undefined) {
            const target = await api.queuedRecordSession(op.eventId, op.createdAt);
            if (target.hold) throw new Error(target.hold);
            photoSession = target.sessionId || null;
          }
          const paths = await api.addTeamPhoto(op.eventId, op.number, op.dataUrl, op.angle, op.id, op.generation || "0", photoSession);
          if (!paths) {
            handlers.onRobotPhotoDiscarded && handlers.onRobotPhotoDiscarded(op);
          } else if (cancelledOps.has(opCancelKey)) {
            await api.removeTeamPhoto(op.eventId, op.number, api.robotPhotoPath(op.eventId, op.number, op.angle, op.id, (String(op.dataUrl).match(/^data:([^;,]+)/) || [])[1], photoSession));
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
