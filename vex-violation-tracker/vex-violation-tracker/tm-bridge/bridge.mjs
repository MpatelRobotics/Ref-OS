#!/usr/bin/env node
/**
 * Ref-OS ↔ Tournament Manager bridge  (OPTIONAL — see README)
 * --------------------------------------------------------------
 * Runs on a laptop on the SAME LOCAL NETWORK as the Tournament Manager machine.
 * It reads the match schedule/results from TM's Public API and upserts them into
 * the same Supabase your Ref-OS app already reads from. The web app is unchanged
 * and works fine without this — the bridge only *adds* automatic sync.
 *
 * Auth follows the TM Public API Guide v1.2:
 *   1) OAuth 2.0 client-credentials → bearer token (cached until it expires)
 *   2) Per-request HMAC-SHA256 signature using the Event Partner's API key
 *
 * Nothing is written back to TM. Read-only.
 *
 * Requires Node 18+ (built-in fetch + crypto). Config comes from environment
 * variables (see .env.example) — no secrets are hardcoded.
 */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/* ----------------------------- config ----------------------------- */
const {
  TM_CLIENT_ID,
  TM_CLIENT_SECRET,
  TM_API_KEY,                 // the key the Event Partner generates in TM
  TM_HOST,                    // TM machine host[:port], e.g. "10.0.0.5" or "localhost:8080"
  TM_SCHEME = "http",         // TM local API is usually http on the LAN
  SUPABASE_URL,
  SUPABASE_KEY,               // service-role or anon key with insert/update on matches
  EVENT_ID,                   // your Ref-OS event id (the UUID used in the app)
  POLL_SECONDS = "60",        // guide says no faster than ~once per minute
  DRY_RUN = "",               // set to "1" to log what it WOULD do, without writing
} = process.env;

const OAUTH_URL = "https://auth.vextm.dwabtech.com/oauth2/token";

// ── Resource paths (confirmed from TM Public API Guide v1.2) ──
//   Match List:  GET /api/matches/{division_id}
//   Team List:   GET /api/teams            (or /api/teams/{division_id})
//   Rankings:    GET /api/rankings/{division_id}/{match_round}
// Most single-division events use division 1. Override with TM_DIVISION_ID if needed.
const TM_DIVISION_ID = process.env.TM_DIVISION_ID || "1";
const MATCHES_PATH = `/api/matches/${TM_DIVISION_ID}`;

function requireEnv() {
  const missing = ["TM_CLIENT_ID", "TM_CLIENT_SECRET", "TM_API_KEY", "TM_HOST", "SUPABASE_URL", "SUPABASE_KEY", "EVENT_ID"]
    .filter((k) => !process.env[k]);
  if (missing.length) { console.error("Missing env vars:", missing.join(", "), "\nSee .env.example."); process.exit(1); }
}

/* --------------------------- OAuth token --------------------------- */
let tokenCache = { value: null, expiresAt: 0 };
async function getToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt - 30_000) return tokenCache.value;
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: TM_CLIENT_ID, client_secret: TM_CLIENT_SECRET });
  const res = await fetch(OAUTH_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!res.ok) throw new Error(`OAuth token failed: ${res.status} ${await res.text()}`);
  const json = await res.json();               // { access_token, token_type, expires_in }
  tokenCache = { value: json.access_token, expiresAt: Date.now() + (json.expires_in || 300) * 1000 };
  console.log(`[auth] got token, expires in ${json.expires_in}s`);
  return tokenCache.value;
}

/* --------------------- request signing (HMAC) ---------------------- */
// StringToSign per the guide:
//   VERB \n PATH+QUERY \n token:{bearer} \n host:{host} \n x-tm-date:{date} \n
function signAndHeaders(method, pathAndQuery, bearer) {
  const date = new Date().toUTCString();       // RFC 1123
  const stringToSign =
    method + "\n" +
    pathAndQuery + "\n" +
    "token:" + bearer + "\n" +
    "host:" + TM_HOST + "\n" +
    "x-tm-date:" + date + "\n";
  const signature = crypto.createHmac("sha256", TM_API_KEY).update(stringToSign).digest("hex");
  return {
    "Host": TM_HOST,
    "Authorization": `Bearer ${bearer}`,
    "x-tm-date": date,
    "x-tm-signature": signature,
  };
}

// GET with signing + polite If-Modified-Since caching. Returns null on 304.
const lastModified = {};    // pathAndQuery -> Last-Modified header value
async function signedGet(pathAndQuery) {
  const bearer = await getToken();
  const headers = signAndHeaders("GET", pathAndQuery, bearer);
  if (lastModified[pathAndQuery]) headers["If-Modified-Since"] = lastModified[pathAndQuery];
  const res = await fetch(`${TM_SCHEME}://${TM_HOST}${pathAndQuery}`, { headers });
  if (res.status === 304) return null;                       // unchanged since last poll
  if (!res.ok) throw new Error(`GET ${pathAndQuery} → ${res.status} ${await res.text()}`);
  const lm = res.headers.get("last-modified"); if (lm) lastModified[pathAndQuery] = lm;
  return res.json();
}

/* -------------------- map TM match → Ref-OS row -------------------- */
// Confirmed shape (TM Public API Guide v1.2):
//   match.matchInfo.matchTuple = { session, division, round, instance, match }
//   match.matchInfo.alliances  = [ { teams:[{number}] } (RED), { teams:[{number}] } (BLUE) ]
//   match.matchInfo.state      = e.g. "SCORED"
//   match.finalScore           = [redScore, blueScore]
//   match.winningAlliance      = 0 (red) | 1 (blue) | -1/absent (none/tie)
// Ref-OS phases: 'qual' | 'r16' | 'qf' | 'sf' | 'final'.
const ROUND_TO_PHASE = {
  QUAL: "qual", QUALIFICATION: "qual", PRACTICE: "practice",
  R16: "r16", ROUND_OF_16: "r16", ROUNDOF16: "r16", RO16: "r16",
  QF: "qf", QUARTER: "qf", QUARTERFINAL: "qf", QUARTER_FINAL: "qf",
  SF: "sf", SEMI: "sf", SEMIFINAL: "sf", SEMI_FINAL: "sf",
  F: "final", FINAL: "final", FINALS: "final",
};
function allianceTeams(alliance) {
  return ((alliance && alliance.teams) || []).map((t) => String(t.number)).filter(Boolean);
}
function mapTmMatch(m) {
  const info = m.matchInfo || m;
  const tuple = info.matchTuple || {};
  const phase = ROUND_TO_PHASE[String(tuple.round || "").toUpperCase()] || "qual";
  const num = Number(tuple.match ?? tuple.instance ?? 0);
  const alliances = info.alliances || [];
  const red = allianceTeams(alliances[0]);
  const blue = allianceTeams(alliances[1]);
  // winner: 0 = red, 1 = blue; anything else = undecided
  const wa = m.winningAlliance;
  const winner = wa === 0 ? "red" : wa === 1 ? "blue" : null;
  return { phase, num, red, blue, field: info.field ?? null, label: null, winner };
}

/* ------------------------- Supabase upsert ------------------------- */
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } }) : null;
const SYNC_WINNERS = !!process.env.SYNC_WINNERS; // off by default: the app's bracket manager stays authoritative
async function upsertMatches(rows) {
  const payload = rows
    .filter((r) => r.num > 0 && (r.red.length || r.blue.length))
    .map((r) => {
      const row = { event_id: EVENT_ID, phase: r.phase, num: r.num, red: r.red, blue: r.blue, field: r.field, label: r.label };
      if (SYNC_WINNERS && r.winner) row.winner = r.winner; // only touch winner when explicitly enabled
      return row;
    });
  if (!payload.length) return 0;
  if (DRY_RUN) { console.log(`[dry-run] would upsert ${payload.length} matches:`, JSON.stringify(payload.slice(0, 3), null, 2), payload.length > 3 ? "…" : ""); return payload.length; }
  // When SYNC_WINNERS is off, `winner` is never sent, so app-set bracket winners are preserved.
  const { error } = await supabase.from("matches").upsert(payload, { onConflict: "event_id,phase,num" });
  if (error) throw error;
  return payload.length;
}

/* ----------------------------- poll ------------------------------- */
async function pollOnce() {
  const data = await signedGet(MATCHES_PATH);
  if (data === null) { console.log("[poll] no changes"); return; }
  if (DRY_RUN) console.log("[dry-run] raw matches response (inspect this to finalize mapTmMatch + MATCHES_PATH):\n", JSON.stringify(data, null, 2).slice(0, 4000));
  const list = Array.isArray(data) ? data : (data.matches ?? data.items ?? []);
  const rows = list.map(mapTmMatch);
  const n = await upsertMatches(rows);
  console.log(`[poll] synced ${n} matches @ ${new Date().toLocaleTimeString()}`);
}

async function main() {
  requireEnv();
  const every = Math.max(30, Number(POLL_SECONDS)) * 1000;   // never faster than 30s; guide recommends ~60s
  console.log(`Ref-OS ↔ TM bridge starting. host=${TM_HOST} event=${EVENT_ID} poll=${every / 1000}s ${DRY_RUN ? "(DRY RUN)" : ""}`);
  // one immediate pass, then loop; keep running through transient TM/network errors
  for (;;) {
    try { await pollOnce(); }
    catch (e) { console.error("[error]", e.message || e); }   // don't crash — TM tolerates short outages
    await new Promise((r) => setTimeout(r, every));
  }
}
main();
