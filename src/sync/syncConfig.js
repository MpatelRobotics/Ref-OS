// Per-device sync mode for Ref OS.
//   cloud  (default) — the existing Supabase behaviour, unchanged.
//   venue  — Phase 1 live operations data goes through a Ref OS Venue Server on the local network.
// Stored on this device only (localStorage). A device that opened Ref OS from a venue server's own
// address (http://<venue-ip>:8080) is switched to venue mode automatically unless it chose otherwise.

const CONFIG_KEY = "refosSyncConfig";
export const DEFAULT_VENUE_URL = "http://refos.local:8080";
const listeners = new Set();

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
    if (value && (value.mode === "cloud" || value.mode === "venue")) {
      return { mode: value.mode, serverUrl: String(value.serverUrl || DEFAULT_VENUE_URL), source: value.source || "user" };
    }
  } catch {}
  return { mode: "cloud", serverUrl: DEFAULT_VENUE_URL, source: "default" };
}

let current = read();

export const getSyncConfig = () => ({ ...current });
export const isVenueMode = () => current.mode === "venue";

export function setSyncConfig(next) {
  current = { ...current, ...next };
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(current)); } catch {}
  listeners.forEach((fn) => { try { fn(getSyncConfig()); } catch {} });
  return getSyncConfig();
}

export function onSyncConfigChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Accepts "192.168.1.50", "192.168.1.50:8080", "refos.local:8080", "http://host:port/".
// Returns { url } (origin only, no path) or { error }.
export function normalizeServerUrl(input) {
  let text = String(input || "").trim();
  if (!text) return { error: "Enter the venue server address." };
  if (!/^[a-z]+:\/\//i.test(text)) text = `http://${text}`;
  let parsed;
  try { parsed = new URL(text); } catch { return { error: "That is not a valid address." }; }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { error: "Use an http:// or https:// address." };
  if (!parsed.hostname) return { error: "Enter a host name or IP address." };
  if (parsed.username || parsed.password) return { error: "Do not include a user name or password." };
  const port = parsed.port ? Number(parsed.port) : null;
  if (port !== null && (port < 1 || port > 65535)) return { error: "Port must be between 1 and 65535." };
  if (!parsed.port && !/^https?:\/\/[^/]+:\d+/i.test(text)) parsed.port = "8080";
  return { url: parsed.origin };
}

// A page served over https cannot call an http:// server (browsers block mixed content).
export function mixedContentProblem(serverUrl) {
  try {
    return typeof location !== "undefined" && location.protocol === "https:" && new URL(serverUrl).protocol === "http:";
  } catch { return false; }
}

export function deviceId() {
  try {
    let id = localStorage.getItem("refosDeviceId");
    if (!id) {
      id = uuid();
      localStorage.setItem("refosDeviceId", id);
    }
    return id;
  } catch {
    return `session-${uuid()}`;
  }
}

// RFC 4122 v4. crypto.getRandomValues works on plain http:// LAN pages (randomUUID does not).
export function uuid() {
  const c = globalThis.crypto;
  if (c?.randomUUID) { try { return c.randomUUID(); } catch {} }
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Only pages served over plain http from a non-cloud host are probed; the https cloud app never is.
export function shouldProbeServedByVenue() {
  try {
    return typeof location !== "undefined" && location.protocol === "http:" && current.source !== "user"
      && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  } catch { return false; }
}

// If this page itself is served by a Ref OS Venue Server, use it (unless the device chose a mode).
export async function detectServedByVenue(timeoutMs = 1500) {
  if (!shouldProbeServedByVenue()) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${location.origin}/api/v1/health`, { signal: controller.signal, cache: "no-store" });
    const body = await response.json();
    if (body?.service === "refos-venue-server") {
      setSyncConfig({ mode: "venue", serverUrl: location.origin, source: "auto" });
      return true;
    }
  } catch {} finally { clearTimeout(timer); }
  return false;
}
