/* =====================================================================
   Photo cache (IndexedDB). A CACHE ONLY: Supabase Storage is the shared
   source of truth, and every photo shown here also exists in the cloud.

   Entries are keyed by storage path. Paths are unique per upload
   (<event>/team/<TEAM>/<angle>-<uuid>.webp), so a cached entry never goes
   stale: a replacement photo is a new path, and the old path is pruned.

   Store: db "refos-photo-cache", object store "photos":
     { path, eventId, blob, bytes, cachedAt, lastUsed }
   ===================================================================== */

const DB_NAME = "refos-photo-cache";
const STORE = "photos";
const MAX_CACHE_BYTES = 150 * 1024 * 1024; // least recently used photos are evicted beyond this

let dbPromise = null;
function db() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: "path" });
        store.createIndex("eventId", "eventId", { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { dbPromise = null; reject(request.error); };
    });
  }
  return dbPromise;
}
const done = (request) => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
async function tx(mode, work) {
  const database = await db();
  const transaction = database.transaction(STORE, mode);
  // Listen for completion BEFORE doing any work, so a fast transaction can't finish unobserved.
  const completed = new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); });
  const result = await work(transaction.objectStore(STORE));
  await completed;
  return result;
}

export const eventIdFromPath = (path) => String(path || "").split("/")[0] || "";
const isRobotPath = (path) => /^[^/]+\/team\//.test(String(path || ""));

// In-memory object URLs so thumbnails and the full-screen viewer share one URL per path.
const objectUrls = new Map();
function objectUrlFor(path, blob) {
  if (!objectUrls.has(path)) objectUrls.set(path, URL.createObjectURL(blob));
  return objectUrls.get(path);
}
function releaseObjectUrl(path) {
  const url = objectUrls.get(path);
  if (url) { URL.revokeObjectURL(url); objectUrls.delete(path); }
}

export async function getCachedBlob(path) {
  try {
    return await tx("readwrite", async (store) => {
      const entry = await done(store.get(path));
      if (!entry) return null;
      entry.lastUsed = Date.now();
      store.put(entry);
      return entry.blob || null;
    });
  } catch { return null; }
}

export async function putCachedBlob(path, blob) {
  if (!path || !blob) return;
  try {
    await tx("readwrite", async (store) => {
      const now = Date.now();
      store.put({ path, eventId: eventIdFromPath(path), blob, bytes: blob.size || 0, cachedAt: now, lastUsed: now });
    });
    await enforceLimit();
  } catch { /* caching is best effort */ }
}

async function enforceLimit() {
  const entries = await tx("readonly", async (store) => done(store.getAll()));
  let total = entries.reduce((sum, entry) => sum + (entry.bytes || 0), 0);
  if (total <= MAX_CACHE_BYTES) return;
  const oldestFirst = entries.sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));
  const evict = [];
  for (const entry of oldestFirst) {
    if (total <= MAX_CACHE_BYTES * 0.9) break;
    evict.push(entry.path);
    total -= entry.bytes || 0;
  }
  await deletePaths(evict);
}

export async function deletePaths(paths) {
  const list = (paths || []).filter(Boolean);
  if (!list.length) return;
  list.forEach(releaseObjectUrl);
  try { await tx("readwrite", async (store) => { list.forEach((path) => store.delete(path)); }); } catch {}
}

async function pathsForEvent(eventId) {
  return tx("readonly", async (store) => done(store.index("eventId").getAllKeys(eventId)));
}

// Every cached photo for one event (used after that event is permanently deleted).
export async function deleteEventCache(eventId) {
  if (!eventId) return;
  try { await deletePaths(await pathsForEvent(eventId)); } catch {}
}

// Robot photos for this event that are no longer referenced by any team (replaced, deleted, or reset).
// Entries cached in the last two minutes are kept: a photo this device just uploaded can be cached
// before a refreshed team list that references it arrives.
export async function pruneEventRobotPhotos(eventId, currentPaths) {
  if (!eventId) return;
  const keep = new Set(currentPaths || []);
  const recent = Date.now() - 2 * 60 * 1000;
  try {
    const entries = await tx("readonly", async (store) => done(store.index("eventId").getAll(eventId)));
    const stale = entries.filter((entry) => isRobotPath(entry.path) && !keep.has(entry.path) && (entry.cachedAt || 0) < recent).map((entry) => entry.path);
    await deletePaths(stale);
  } catch {}
}

// Orphan cleanup: cached photos for events that no longer exist at all.
export async function pruneMissingEvents(existingEventIds) {
  const existing = new Set(existingEventIds || []);
  if (!existing.size) return; // never wipe the cache on an empty or failed event list
  try {
    const keys = await tx("readonly", async (store) => done(store.getAllKeys()));
    await deletePaths(keys.filter((path) => !existing.has(eventIdFromPath(path))));
  } catch {}
}

// Load a photo for display. Resolves to { url } or { status: "offline" | "missing" }.
//   1. IndexedDB hit: display immediately (works offline).
//   2. Otherwise, when online: signed URL -> download -> cache -> display.
//   3. Offline and never cached: report "offline"; never pretend it is available.
export async function loadPhoto(path, getSignedUrl) {
  if (!path) return { status: "missing" };
  if (objectUrls.has(path)) return { url: objectUrls.get(path) };
  const cached = await getCachedBlob(path);
  if (cached) return { url: objectUrlFor(path, cached) };
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { status: "offline" };
  try {
    const signed = await getSignedUrl(path);
    if (!signed) return { status: "missing" };
    const response = await fetch(signed);
    if (!response.ok) return { status: response.status === 404 || response.status === 400 ? "missing" : "offline" };
    const blob = await response.blob();
    await putCachedBlob(path, blob);
    return { url: objectUrlFor(path, blob) };
  } catch {
    return { status: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "missing" };
  }
}
