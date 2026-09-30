#!/usr/bin/env node
// Ref OS Venue Server — Phase 1.
//
// Lets Ref OS devices on the same venue network share live event operations data (violations,
// field log, volunteer roster and presence) through a mini PC when the internet is unavailable.
// Authentication, event administration, and everything else still use Supabase.
//
// Zero npm dependencies: Node 22.13+ (built-in node:sqlite).
//   node server.mjs                     start (port 8080, all interfaces)
//   node server.mjs --list-events       events paired with this server
//   node server.mjs --forget-event <id> [--purge]   unpair an event (optionally delete its data)
import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, statSync, createReadStream } from "node:fs";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces, hostname } from "node:os";
import { openStore } from "./store.mjs";
import { isEventId, isVenueKey, isDeviceId, validateChange, KINDS } from "./validate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8"));
export const SERVER_VERSION = pkg.version;
export const API_VERSION = 1;

function readConfig(env = process.env) {
  const dataDir = resolve(env.REFOS_VENUE_DATA || join(HERE, "data"));
  const defaultWeb = resolve(HERE, "..", "dist");
  const webRoot = env.REFOS_WEB_ROOT ? resolve(env.REFOS_WEB_ROOT) : (existsSync(join(defaultWeb, "index.html")) ? defaultWeb : null);
  const allowedOrigins = String(env.REFOS_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
  return {
    port: Number(env.PORT || 8080),
    host: env.HOST || "0.0.0.0",
    dataDir,
    webRoot,
    allowedOrigins,
    maxChangesPerRequest: 200,
    maxBodyBytes: 8 * 1024 * 1024,
  };
}

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
function sameHash(a, b) {
  const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---- tiny per-IP throttle for failed authorizations (guessing protection) ----
function makeThrottle({ limit = 20, windowMs = 5 * 60 * 1000 } = {}) {
  const hits = new Map();
  return {
    blocked(ip, now) { const h = hits.get(ip); return !!h && now - h.start < windowMs && h.count >= limit; },
    fail(ip, now) {
      const h = hits.get(ip);
      if (!h || now - h.start >= windowMs) hits.set(ip, { start: now, count: 1 });
      else h.count += 1;
      if (hits.size > 5000) hits.clear();
    },
  };
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".ico": "image/x-icon", ".pdf": "application/pdf", ".onnx": "application/octet-stream", ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2", ".woff": "font/woff", ".map": "application/json",
};

export function createVenueServer(config = readConfig()) {
  const store = openStore(config.dataDir);
  const throttle = makeThrottle();
  const log = (...args) => { if (!config.quiet) console.log(new Date().toISOString(), ...args); };

  const send = (res, status, body, headers = {}) => {
    const text = body === undefined ? "" : JSON.stringify(body);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers });
    res.end(text);
  };

  // CORS: same-origin always works (the app served by this server). Other origins only when
  // listed in REFOS_ALLOWED_ORIGINS. Nothing is ever allowed with a wildcard.
  function corsHeaders(req) {
    const origin = req.headers.origin;
    if (!origin) return {};
    const selfOrigins = [`http://${req.headers.host}`, `https://${req.headers.host}`];
    if (selfOrigins.includes(origin) || config.allowedOrigins.includes(origin)) {
      return {
        "Access-Control-Allow-Origin": origin,
        "Vary": "Origin",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Refos-Device, X-Refos-Device-Label",
        "Access-Control-Allow-Private-Network": "true",
        "Access-Control-Max-Age": "600",
      };
    }
    return null; // disallowed cross-origin request
  }

  function readJson(req, limit) {
    return new Promise((resolveBody, reject) => {
      let size = 0;
      const chunks = [];
      req.on("data", (chunk) => {
        size += chunk.length;
        if (size > limit) { reject(Object.assign(new Error("Request body too large"), { status: 413 })); req.destroy(); return; }
        chunks.push(chunk);
      });
      req.on("end", () => {
        try { resolveBody(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); }
        catch { reject(Object.assign(new Error("Invalid JSON"), { status: 400 })); }
      });
      req.on("error", reject);
    });
  }

  // Event authorization: the Bearer token must be this event's venue sync key (issued by
  // Supabase only to signed-in members of the event). The server keeps only its SHA-256.
  function authorize(req, eventId, ip, now) {
    if (throttle.blocked(ip, now)) return { status: 429, error: "Too many failed attempts. Try again later." };
    const match = /^Bearer\s+([0-9a-f]{64})$/i.exec(String(req.headers.authorization || ""));
    const key = match ? match[1].toLowerCase() : null;
    const record = store.getEvent(eventId);
    if (!key || !record || !sameHash(sha256(key), record.key_hash)) {
      throttle.fail(ip, now);
      return { status: 401, error: record ? "Not authorized for this event." : "This event is not paired with this venue server." };
    }
    return { ok: true };
  }

  function deviceFrom(req) {
    const id = String(req.headers["x-refos-device"] || "");
    let label = "";
    try { label = decodeURIComponent(String(req.headers["x-refos-device-label"] || "")).slice(0, 80); } catch {}
    return { id: isDeviceId(id) ? id : null, label };
  }

  function serveStatic(req, res, pathname) {
    if (!config.webRoot) return send(res, 404, { error: "Not found" });
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, { error: "Bad path" }); }
    const root = config.webRoot;
    let file = normalize(join(root, rel));
    if (!file.startsWith(root + sep) && file !== root) return send(res, 403, { error: "Forbidden" });
    let st = existsSync(file) ? statSync(file) : null;
    if (st?.isDirectory()) { file = join(file, "index.html"); st = existsSync(file) ? statSync(file) : null; }
    if (!st && !extname(rel)) { file = join(root, "index.html"); st = existsSync(file) ? statSync(file) : null; } // SPA route
    if (!st) return send(res, 404, { error: "Not found" });
    const type = MIME[extname(file).toLowerCase()] || "application/octet-stream";
    const noCache = file.endsWith("index.html") || file.endsWith("sw.js");
    res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "X-Content-Type-Options": "nosniff",
      "Cache-Control": noCache ? "no-cache" : "public, max-age=3600" });
    if (req.method === "HEAD") return res.end();
    createReadStream(file).pipe(res);
  }

  async function handle(req, res) {
    const now = Date.now();
    const ip = req.socket.remoteAddress || "unknown";
    const url = new URL(req.url, "http://venue.local");
    const path = url.pathname;
    const isApi = path.startsWith("/api/");
    const cors = isApi ? corsHeaders(req) : {};
    if (isApi && cors === null) return send(res, 403, { error: "Origin not allowed" });
    if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
    if (!isApi) {
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "Method not allowed" });
      return serveStatic(req, res, path);
    }

    if (path === "/api/v1/health" && req.method === "GET") {
      return send(res, 200, { service: "refos-venue-server", version: SERVER_VERSION, apiVersion: API_VERSION, status: "ok", serverTime: new Date(now).toISOString() }, cors);
    }

    const m = /^\/api\/v1\/events\/([^/]+)\/(register|changes|export|status)$/.exec(path);
    if (!m) return send(res, 404, { error: "Not found" }, cors);
    const eventId = m[1].toLowerCase();
    const action = m[2];
    if (!isEventId(eventId)) return send(res, 400, { error: "Invalid event id" }, cors);
    const device = deviceFrom(req);

    if (action === "register" && req.method === "POST") {
      // Pair this event with the server. The first pairing stores the key hash; after that only
      // the same key is accepted (re-pairing needs --forget-event on the server).
      if (throttle.blocked(ip, now)) return send(res, 429, { error: "Too many failed attempts. Try again later." }, cors);
      const match = /^Bearer\s+([0-9a-f]{64})$/i.exec(String(req.headers.authorization || ""));
      const key = match ? match[1].toLowerCase() : null;
      if (!isVenueKey(key || "")) { throttle.fail(ip, now); return send(res, 401, { error: "Missing venue sync key." }, cors); }
      const existing = store.getEvent(eventId);
      if (!existing) {
        store.registerEvent(eventId, sha256(key), device.id, now);
        log("paired event", eventId, "device", device.id || "unknown");
        return send(res, 200, { paired: true, created: true, latestSeq: 0 }, cors);
      }
      if (!sameHash(sha256(key), existing.key_hash)) { throttle.fail(ip, now); return send(res, 409, { error: "This event is paired with a different venue sync key on this server." }, cors); }
      return send(res, 200, { paired: true, created: false, latestSeq: store.latestSeq(eventId) }, cors);
    }

    const auth = authorize(req, eventId, ip, now);
    if (!auth.ok) return send(res, auth.status, { error: auth.error }, cors);
    if (device.id) store.touchDevice(eventId, device.id, device.label, now);

    if (action === "changes" && req.method === "GET") {
      const since = Math.max(0, Number.parseInt(url.searchParams.get("since") || "0", 10) || 0);
      const limit = Math.min(1000, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "500", 10) || 500));
      const changes = store.changesSince(eventId, since, limit);
      const latestSeq = store.latestSeq(eventId);
      const nextSince = changes.length ? changes[changes.length - 1].seq : (changes.length < limit ? latestSeq : since);
      return send(res, 200, { changes, latestSeq, nextSince, hasMore: changes.length === limit, serverTime: new Date(now).toISOString() }, cors);
    }

    if (action === "changes" && req.method === "POST") {
      if (!device.id) return send(res, 400, { error: "X-Refos-Device header required" }, cors);
      let body;
      try { body = await readJson(req, config.maxBodyBytes); }
      catch (error) { return send(res, error.status || 400, { error: error.message }, cors); }
      const list = Array.isArray(body?.changes) ? body.changes : null;
      if (!list || !list.length) return send(res, 400, { error: "changes[] required" }, cors);
      if (list.length > config.maxChangesPerRequest) return send(res, 413, { error: "Too many changes in one request" }, cors);
      const valid = [];
      const results = [];
      for (const raw of list) {
        const checked = validateChange(raw);
        if (checked.error) results.push({ changeId: typeof raw?.changeId === "string" ? raw.changeId.slice(0, 128) : null, status: "invalid", error: checked.error });
        else valid.push(checked.change);
      }
      const applied = valid.length ? store.applyChanges(eventId, device.id, valid, now) : [];
      return send(res, 200, { results: [...applied, ...results], latestSeq: store.latestSeq(eventId) }, cors);
    }

    if (action === "export" && req.method === "GET") {
      const rows = store.exportRecords(eventId);
      const groups = { violations: [], fieldLog: [], roster: [] };
      const target = { violation: groups.violations, field_log: groups.fieldLog, roster: groups.roster };
      for (const row of rows) {
        const bucket = target[row.kind];
        if (!bucket) continue; // presence heartbeats are ephemeral and not exported
        bucket.push({ id: row.record_id, deleted: !!row.deleted, version: row.version, updatedAt: new Date(row.updated_at).toISOString(), updatedByDevice: row.updated_by, data: JSON.parse(row.data) });
      }
      return send(res, 200, {
        format: "refos-venue-export", formatVersion: 1, serverVersion: SERVER_VERSION,
        exportedAt: new Date(now).toISOString(), eventId,
        reconciledToCloud: false,
        note: "Ref OS Venue Server data. Not yet copied to Supabase automatically; keep this file until it is reconciled.",
        counts: store.counts(eventId), latestSeq: store.latestSeq(eventId),
        devices: store.listDevices(eventId).map((d) => ({ deviceId: d.device_id, label: d.label || "", lastSeen: new Date(d.last_seen).toISOString() })),
        ...groups,
      }, { ...cors, "Content-Disposition": `attachment; filename="refos-venue-${eventId}.json"` });
    }

    if (action === "status" && req.method === "GET") {
      return send(res, 200, { eventId, latestSeq: store.latestSeq(eventId), counts: store.counts(eventId), devices: store.listDevices(eventId).length, serverTime: new Date(now).toISOString() }, cors);
    }

    return send(res, 405, { error: "Method not allowed" }, cors);
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error("request failed", error?.message || error);
      if (!res.headersSent) send(res, 500, { error: "Internal server error" });
      else res.end();
    });
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  return { server, store, config };
}

function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const addr of list || []) if (addr.family === "IPv4" && !addr.internal) out.push({ name, address: addr.address });
  }
  return out;
}

// ---- command line ----
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const config = readConfig();
  if (args.includes("--list-events") || args.includes("--forget-event")) {
    const store = openStore(config.dataDir);
    if (args.includes("--list-events")) {
      const rows = store.listEvents();
      if (!rows.length) console.log("No events are paired with this venue server.");
      for (const r of rows) console.log(`${r.event_id}  paired ${new Date(r.registered_at).toISOString()}  records ${r.records}  latest change ${r.latest_seq || 0}`);
    } else {
      const id = String(args[args.indexOf("--forget-event") + 1] || "").toLowerCase();
      if (!isEventId(id)) { console.error("Usage: node server.mjs --forget-event <event-uuid> [--purge]"); process.exit(1); }
      const purge = args.includes("--purge");
      store.forgetEvent(id, purge);
      console.log(`Event ${id} unpaired${purge ? " and its venue data deleted" : " (its venue data was kept)"}.`);
    }
    store.close();
    process.exit(0);
  }
  const { server } = createVenueServer(config);
  server.listen(config.port, config.host, () => {
    console.log(`Ref OS Venue Server ${SERVER_VERSION} (API v${API_VERSION}) listening on ${config.host}:${config.port}`);
    console.log(`Data: ${join(config.dataDir, "refos-venue.sqlite")}`);
    console.log(config.webRoot ? `Serving Ref OS app from ${config.webRoot}` : "No Ref OS build found (run npm run build in the Ref OS folder to serve the app from this server).");
    console.log(`Record kinds: ${KINDS.join(", ")}`);
    console.log("Connect Ref OS devices to one of:");
    console.log(`  http://${hostname().toLowerCase()}.local:${config.port}  (only if this network resolves .local names)`);
    for (const a of lanAddresses()) console.log(`  http://${a.address}:${config.port}  (${a.name})`);
  });
  const stop = () => { console.log("Stopping Ref OS Venue Server."); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
