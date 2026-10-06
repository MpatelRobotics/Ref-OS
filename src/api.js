import { supabase } from "./supabaseClient";
import { OFFLINE_RULES } from "./offlineRules";
import { putCachedBlob, deletePaths as deleteCachedPhotos } from "./photoCache";
import { isVenueMode } from "./sync/syncConfig";
import * as venue from "./sync/venueSync";

const E2E_MOCK = import.meta.env.VITE_E2E_MOCK === "1";
const e2eState = { teams: [], violations: [] };
let e2eRobotGeneration = "0";

export const uid = () =>
  (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) ||
  Date.now().toString(36) + Math.random().toString(36).slice(2);

/* ================= League sessions: device context =================
   A League event holds several sessions (Session 1, Session 2, ..., League Finals). While this
   device works in a league session, the session-scoped reads and writes in this file are limited
   to that session and new records are stamped with it. Tournament events never set a session, so
   every function below behaves exactly as before for them.
   EVENT-SCOPED (league-wide): teams, rules, access codes, event members and volunteer profiles,
   event settings (except the snapshot keys below), watch notes, ref roster, branding.
   SESSION-SCOPED: matches, violations, field log (except the league-wide kinds below), field
   reset checks, alliances, nominations, finalists, attendance, robot inspection photos, and the
   imported rankings / skills / qualification-record snapshots. */
export const LEAGUE_SESSION_SETTING_KEYS = new Set(["skills_rankings", "qualification_records", "judging_rank_order", "rank_snapshot"]);
export const LEAGUE_EVENT_SCOPED_FIELD_LOG_KINDS = new Set(["role_code_update", "role_code_request", "volunteer_contact", "sync_probe", "sync_ack", "system_test"]);
let leagueContext = { eventId: "", sessionId: "", legacySessionId: "" };
// legacySessionId: for a League converted from a Tournament, the session that owns the
// Tournament-era records that have no session of their own (robot photos without a session
// folder, Local Venue Server records, offline caches).
export function setLeagueContext(eventId, sessionId, legacySessionId = "") {
  leagueContext = { eventId: String(eventId || ""), sessionId: String(sessionId || ""), legacySessionId: String(legacySessionId || "") };
}
export function leagueLegacySessionFor(eventId) {
  return eventId && leagueContext.eventId === eventId && leagueContext.legacySessionId ? leagueContext.legacySessionId : null;
}
export function leagueSessionFor(eventId) {
  return eventId && leagueContext.eventId === eventId && leagueContext.sessionId ? leagueContext.sessionId : null;
}
export const leagueSettingKey = (key, sessionId) => `${key}@${sessionId}`;
export const leagueSessionPhotoMarker = (sessionId) => `/s-${sessionId}/`;
// Session that a robot photo path belongs to (<event>/team/<TEAM>/s-<session>/<angle>-<id>.webp), or null.
export function photoSessionId(path) {
  const m = String(path || "").match(/\/s-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i);
  return m ? m[1].toLowerCase() : null;
}
// Session a robot photo belongs to in this event: its session folder, or (no folder) the session
// created when the event was converted from a Tournament. null for tournaments.
export function photoSessionFor(eventId, path) {
  return photoSessionId(path) || leagueLegacySessionFor(eventId);
}
// Robot photos shown for the current view: in a league session, only that session's photos.
function viewPhotoKeys(eventId, paths) {
  const list = paths || [];
  const sid = leagueSessionFor(eventId);
  return sid ? list.filter((path) => photoSessionFor(eventId, path) === sid) : list;
}
const isMissingConflictTarget = (error) =>
  error?.code === "42P10" || error?.code === "42703" || /no unique or exclusion constraint|session_key/i.test(error?.message || "");
// matches, field_reset_checks, alliances and shortlist gained session_key in their primary key
// (refos-2-league-events.sql). Until that file runs, tournaments keep using the old conflict target.
const conflictTargetMode = {};
async function upsertSessionKeyed(table, rows, newTarget, oldTarget, { sessionId = null, finish = (q) => q } = {}) {
  const run = (target) => finish(supabase.from(table).upsert(rows, { onConflict: target }));
  if (conflictTargetMode[table] !== "old" || sessionId) {
    const result = await run(newTarget);
    if (!result.error) { conflictTargetMode[table] = "new"; return result; }
    if (sessionId || !isMissingConflictTarget(result.error)) return result;
    conflictTargetMode[table] = "old";
  }
  return run(oldTarget);
}

/* ================= server enforced event access ================= */
export async function ensureAnonymousSession() {
  if (E2E_MOCK) return { user: { id: "e2e-user" } };
  const { data: existing } = await supabase.auth.getSession();
  if (existing?.session?.user) return existing.session;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(
    error.message?.includes("Anonymous") ?
      "Anonymous Sign-Ins are not enabled in Supabase Auth. Enable them before using Ref OS 1.2." :
      error.message
  );
  return data.session;
}

export async function claimEventAccess(eventId, credential) {
  if (E2E_MOCK) {
    const value = String(credential || "");
    if (value === "1A23" || value === "test-admin") return { role: "ref", serverRole: "admin", isAdmin: true };
    if (value === "1B23" || value === "test-ref") return { role: "ref", serverRole: "ref", isAdmin: false };
    if (value === "1C23" || value === "test-judge") return { role: "judge", serverRole: "judge", isAdmin: false };
    if (value === "1D23" || value === "test-emcee") return { role: "emcee", serverRole: "emcee", isAdmin: false };
    if (value === "2A23" || value === "test-inspection") return { role: "inspection", serverRole: "inspection", isAdmin: false };
    throw new Error("Invalid event credential");
  }
  await ensureAnonymousSession();
  const { data, error } = await supabase.rpc("claim_event_access", {
    p_event: eventId,
    p_credential: String(credential || ""),
  });
  if (error) {
    // The event's own codes refused it. Ask the trusted server-side Developer check next; a
    // refusal there looks exactly like any other wrong code.
    if (!/Invalid event credential/i.test(String(error.message || ""))) throw error;
    const developer = await claimDeveloperAccess(eventId, credential);
    if (developer === "ok") return { role: "ref", serverRole: "admin", isAdmin: true, developer: true };
    if (developer === "locked") throw new Error("Too many incorrect codes. Wait a few minutes and try again.");
    if (developer === "archived") throw new Error("This event has been archived");
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.role) throw new Error("Invalid event credential.");
  return { role: row.role === "admin" ? "ref" : row.role, serverRole: row.role, isAdmin: !!row.is_admin, developer: false };
}

// Server-side Developer check (refos-developer-access Edge Function). The browser never knows the
// Developer credential; it only forwards the code that was typed. Resolves "ok", "invalid",
// "locked", or "archived". An unavailable function counts as "invalid".
async function claimDeveloperAccess(eventId, credential) {
  try {
    const { data, error } = await supabase.functions.invoke("refos-developer-access", {
      body: { eventId, credential: String(credential || "") },
    });
    if (error || !data) return "invalid";
    if (data.ok === true) return "ok";
    return ["locked", "archived"].includes(data.reason) ? data.reason : "invalid";
  } catch {
    return "invalid";
  }
}

// This device session's own sign-in row for an event: { role, developer } or null.
// Works before refos-2-developer-access.sql is installed (developer is then always false).
async function readMyMembership(eventId, userId) {
  const query = (columns) => supabase.from("event_members").select(columns).eq("event_id", eventId).eq("user_id", userId).maybeSingle();
  let { data, error } = await query("role,developer");
  if (error && (error.code === "42703" || /developer/i.test(String(error.message || "")))) {
    ({ data, error } = await query("role"));
  }
  if (error) return { error };
  return { data: data?.role ? { role: data.role, developer: data.developer === true && data.role === "admin" } : null };
}

export async function getMyEventRole(eventId) {
  if (E2E_MOCK) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.user) return null;
  const { data, error } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", sessionData.session.user.id)
    .maybeSingle();
  if (error) return null;
  return data?.role || null;
}

// Role plus the server-side Developer flag for this device session ({ role, developer } or null).
export async function getMyEventAccess(eventId) {
  if (E2E_MOCK) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.user) return null;
  const { data, error } = await readMyMembership(eventId, sessionData.session.user.id);
  if (error) return null;
  return data;
}

// Like getMyEventAccess, but THROWS when Supabase cannot be reached instead of answering "no
// access". Used only in Local Venue Server mode, so a signed-in device can keep working through an
// internet outage (see App: verified access cache). Resolves { role, developer, userId } or null.
const isNetworkFailure = (error) => {
  const text = `${error?.name || ""} ${error?.message || ""}`;
  return error instanceof TypeError || /AuthRetryableFetchError|failed to fetch|networkerror|network error|load failed|timed out|timeout/i.test(text);
};
export async function getMyEventAccessChecked(eventId) {
  if (E2E_MOCK) return null;
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError && isNetworkFailure(sessionError)) throw sessionError;
  const userId = sessionData?.session?.user?.id;
  if (!userId) return null;
  const { data, error } = await readMyMembership(eventId, userId);
  if (error) {
    if (isNetworkFailure(error)) throw Object.assign(new TypeError(error.message || "Failed to fetch"), { cause: error });
    return null;
  }
  return data ? { ...data, userId } : null;
}

export async function getCurrentUserId() {
  if (E2E_MOCK) return "e2e-user";
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
}

export async function setEventMemberName(eventId, name) {
  if (E2E_MOCK) return;
  const { error } = await supabase.rpc("set_my_event_member_name", {
    p_event: eventId,
    p_name: String(name || "").trim(),
  });
  if (error) throw error;
}

export async function setEventAccessCredentialHash(eventId, credentialName, role, hash, enabled = true) {
  if (E2E_MOCK) return;
  const { error } = await supabase.rpc("set_event_access_credential", {
    p_event: eventId,
    p_name: credentialName,
    p_role: role,
    p_hash: hash,
    p_enabled: enabled,
  });
  if (error) throw error;
}

export async function getEventAccessStatus(eventId) {
  await ensureAnonymousSession();
  const { data, error } = await supabase.rpc("get_event_access_status", { p_event: eventId });
  if (error) throw error;
  return Object.fromEntries((data || []).map((row) => [row.role_name, !!row.enabled]));
}

export async function setEventRoleCode(eventId, role, credential, enabled = true) {
  await ensureAnonymousSession();
  const { error } = await supabase.rpc("set_event_role_code", { p_event: eventId, p_role: role, p_credential: credential, p_enabled: !!enabled });
  if (error) throw error;
}

export async function disableEventAccessCredential(eventId, credentialName) {
  if (E2E_MOCK) return;
  const { error } = await supabase.rpc("disable_event_access_credential", {
    p_event: eventId,
    p_name: credentialName,
  });
  if (error) throw error;
}

export async function clearAccessSession() {
  if (E2E_MOCK) return;
  try { await supabase.auth.signOut({ scope: "local" }); }
  catch { await supabase.auth.signOut(); }
}

// Lock This Device -> Event Main Page keeps this device's session. Before "Unlock as <role>"
// reopens the event, the server must confirm it again:
//   1. the auth session is still accepted by Supabase Auth (getUser checks it server-side),
//   2. this user still has an event_members row for THIS event (RLS, current role),
//   3. the event is not archived.
// Resolves { status: "valid", role, developer } | { status: "invalid", reason } | { status: "archived" }.
// Throws only when the server cannot be reached, so the caller can keep the device locked
// and ask the user to try again instead of treating an outage as a sign-out.
const isAuthFailure = (error) => {
  const status = Number(error?.status || 0);
  return status === 401 || status === 403 || /^PGRST30\d$/.test(String(error?.code || "")) ||
    /jwt|refresh token|session (?:missing|not found|expired)|invalid claim/i.test(String(error?.message || ""));
};
export async function verifyEventSession(eventId) {
  if (E2E_MOCK) return { status: "valid", role: "admin" };
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.user) return { status: "invalid", reason: "session" };
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    if (isAuthFailure(userError)) return { status: "invalid", reason: "session" };
    throw userError;
  }
  const userId = userData?.user?.id;
  if (!userId) return { status: "invalid", reason: "session" };
  const { data, error } = await readMyMembership(eventId, userId);
  if (error) {
    if (isAuthFailure(error)) return { status: "invalid", reason: "session" };
    throw error;
  }
  if (!data?.role) return { status: "invalid", reason: "membership" };
  const lifecycle = await listEventLifecycle();
  if (lifecycle?.get(eventId)?.archivedAt) return { status: "archived" };
  return { status: "valid", role: data.role, developer: data.developer };
}

export async function hasCurrentEventAccess(eventId) {
  if (E2E_MOCK) return true;
  const { data, error } = await supabase.from("event_members").select("role").eq("event_id", eventId).maybeSingle();
  if (error) throw error;
  return !!data?.role;
}

export async function getIdentityResetVersion(eventId) {
  if (E2E_MOCK) return "0";
  const { data, error } = await supabase.from("event_settings").select("value").eq("event_id", eventId).eq("key", "identity_reset").maybeSingle();
  if (error) throw error;
  return String(data?.value?.version || "0");
}

export async function resetVolunteerSignIns(eventId) {
  if (E2E_MOCK) return String(Date.now());
  const { data, error } = await supabase.rpc("reset_volunteer_sign_ins", { p_event: eventId });
  if (error) throw error;
  return String(data || "");
}


export async function listEventMembersForAdmin(eventId) {
  if (E2E_MOCK) return [];
  const { data, error } = await supabase.rpc("list_event_members_for_admin", {
    p_event: eventId,
  });
  if (error) throw error;
  return data || [];
}

export async function setVolunteerAdminRole(eventId, userId, makeAdmin = true) {
  if (E2E_MOCK) return;
  const { error } = await supabase.rpc("set_event_member_admin", {
    p_event: eventId,
    p_user: userId,
    p_make_admin: !!makeAdmin,
  });
  if (error) throw error;
}

export async function downgradeMyEventRole(eventId, role = "ref") {
  if (E2E_MOCK) return;
  const { error } = await supabase.rpc("downgrade_my_event_role", {
    p_event: eventId,
    p_role: role,
  });
  if (error) throw error;
}

/* ================= admin web push notifications ================= */
export async function saveAdminPushSubscription(eventId, subscription) {
  if (E2E_MOCK) return;
  const session = await ensureAnonymousSession();
  const json = subscription?.toJSON?.() || subscription;
  const { error } = await supabase.from("push_subscriptions").upsert({
    endpoint: json.endpoint,
    event_id: eventId,
    user_id: session.user.id,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    user_agent: navigator.userAgent,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) throw error;
}

export async function removeAdminPushSubscription(endpoint) {
  if (E2E_MOCK || !endpoint) return;
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw error;
}

export async function sendRoleCodeRequestPush(requestId) {
  if (E2E_MOCK || !requestId) return { sent: 0 };
  const { data, error } = await supabase.functions.invoke("send-code-request-push", {
    body: { requestId },
  });
  if (error) throw error;
  return data;
}

export async function getAlertStats(eventId) {
  if (E2E_MOCK) return { requests: 0, pushAlerts: 0, emailAlerts: 0, failedEmails: 0, totalAlerts: 0 };
  const { data, error } = await supabase.rpc("get_alert_stats", { p_event: eventId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    requests: Number(row?.requests || 0),
    pushAlerts: Number(row?.push_alerts || 0),
    emailAlerts: Number(row?.email_alerts || 0),
    failedEmails: Number(row?.failed_emails || 0),
    totalAlerts: Number(row?.total_alerts || 0),
  };
}

export async function resetAlertStats(eventId) {
  if (E2E_MOCK) return;
  const { error } = await supabase.rpc("reset_alert_stats", { p_event: eventId });
  if (error) throw error;
}


/* ================= auth ================= */
export const signIn = (email) =>
  supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
export const signOut = () => supabase.auth.signOut();
export const getSession = async () => (await supabase.auth.getSession()).data.session;
export const onAuth = (cb) => supabase.auth.onAuthStateChange((_e, session) => cb(session));

/* ================= profile (ref name) ================= */
export async function getMyName() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
  return data?.name || null;
}
export async function setMyName(name) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").upsert({ id: user.id, name: name.trim() });
}

/* ================= events ================= */
const mapEvent = (r) => r && {
  id: r.id, name: r.name, quals: r.quals, practice: r.practice,
  bracket: r.bracket, finalsBestOf: r.finals_best_of, joinCode: r.join_code,
  // Phase 7 lifecycle (null archivedAt = ACTIVE). Undefined until the Phase 7 SQL is installed.
  createdAt: r.created_at || null,
  archivedAt: r.archived_at || null,
  // League events (refos-2-league-events.sql). Missing or unknown values are Tournaments.
  format: r.event_format === "league" ? "league" : "tournament",
  convertedAt: r.converted_to_league_at || null,
};
export async function listMyEvents() {
  const { data } = await supabase.from("events").select("*").order("created_at", { ascending: false });
  return (data || []).map(mapEvent);
}
export async function listSelectableEvents() {
  if (E2E_MOCK) return [{ id: "11111111-1111-4111-8111-111111111111", name: "Highlander Summit", branding: {} }];
  await ensureAnonymousSession();
  const toChoice = (r) => ({
    id: r.event_id,
    name: r.event_name,
    quals: 0,
    practice: 0,
    bracket: 0,
    finalsBestOf: 1,
    // Phase 6: public branding only (short name, logo URL, accent). Empty when not configured.
    branding: {
      shortName: r.short_name || "",
      logoUrl: r.logo_url || "",
      accent: r.accent_color || "",
    },
  });
  // Phase 7: archive status and creation date, merged onto every event (active and archived).
  const withLifecycle = async (choices) => {
    const [lifecycle, formats] = await Promise.all([listEventLifecycle(), listEventFormats()]);
    return choices.map((choice) => ({
      ...choice,
      archivedAt: lifecycle?.get(choice.id)?.archivedAt || null,
      createdAt: lifecycle?.get(choice.id)?.createdAt || null,
      format: formats?.get(choice.id)?.format || "tournament",
      activeSessionName: formats?.get(choice.id)?.activeSessionName || "",
      sessionCount: formats?.get(choice.id)?.sessionCount || 0,
    }));
  };
  // Phase 6 branding function (supabase/refos-2-phase6-event-settings.sql).
  // Falls back to the Phase 3 selector function if it has not been installed yet.
  const branded = await supabase.rpc("list_refos_event_branding");
  if (!branded.error) return withLifecycle((branded.data || []).map(toChoice));
  const { data, error } = await supabase.rpc("list_refos_events");
  if (error) throw error;
  return withLifecycle((data || []).map(toChoice));
}

/* ================= Phase 7: event lifecycle (supabase/refos-2-phase7-event-management.sql) ================= */
// Public lifecycle metadata: Map(eventId -> { archivedAt, createdAt }). Returns null if the Phase 7
// SQL is not installed, so every event is then treated as active (the pre-Phase 7 behavior).
export async function listEventLifecycle() {
  if (E2E_MOCK) return null;
  const { data, error } = await supabase.rpc("list_refos_event_lifecycle");
  if (error) return null;
  return new Map((data || []).map((r) => [r.event_id, { archivedAt: r.archived_at || null, createdAt: r.created_at || null }]));
}
// League events: Map(eventId -> { format, activeSessionName, sessionCount }), or null before
// refos-2-league-events.sql is installed (every event is then a Tournament).
export async function listEventFormats() {
  if (E2E_MOCK) return null;
  const { data, error } = await supabase.rpc("list_refos_event_formats");
  if (error) return null;
  return new Map((data || []).map((r) => [r.event_id, {
    format: r.event_format === "league" ? "league" : "tournament",
    activeSessionName: r.active_session_name || "",
    sessionCount: Number(r.session_count) || 0,
  }]));
}
// Archive: server allows only an Admin member of this event, and never Highlander.
export async function archiveEvent(eventId) {
  const { data, error } = await supabase.rpc("archive_refos_event", { p_event: eventId });
  if (error) throw error;
  return data;
}
// Permanent delete (archived events only): server requires the exact event name AND this event's
// Admin access code, refuses active and protected events, and deletes atomically.
// Resolves to "deleted", "name_mismatch", "invalid", or "locked".
export async function deleteArchivedEvent(eventId, confirmName, adminCredential) {
  await ensureAnonymousSession();
  const { data, error } = await supabase.rpc("delete_archived_refos_event", {
    p_event: eventId,
    p_confirm_name: String(confirmName || ""),
    p_admin_credential: String(adminCredential || "").trim().toUpperCase(),
  });
  if (error) throw error;
  return String(data || "");
}
// Emergency deletion from the event login screen (forgotten Admin code). Server accepts ONLY the
// Ref OS deletion override, refuses Highlander and protected events, and archives + deletes atomically.
// Resolves to "deleted", "name_mismatch", "invalid", or "locked".
export async function emergencyDeleteEvent(eventId, confirmName, overrideCode) {
  await ensureAnonymousSession();
  const { data, error } = await supabase.rpc("emergency_delete_refos_event", {
    p_event: eventId,
    p_confirm_name: String(confirmName || ""),
    p_override_code: String(overrideCode || "").trim().toUpperCase(),
  });
  if (error) throw error;
  return String(data || "");
}
// Restore: server requires this event's Admin (existing Admin session or the event's Admin access code).
// Resolves to "restored", "active", "invalid", or "locked".
export async function restoreEvent(eventId, adminCredential) {
  await ensureAnonymousSession();
  const { data, error } = await supabase.rpc("restore_refos_event", {
    p_event: eventId,
    p_admin_credential: String(adminCredential || "").trim().toUpperCase(),
  });
  if (error) throw error;
  return String(data || "");
}
export async function getEvent(id) {
  if (E2E_MOCK) return { id, name: "Highlander Summit E2E", quals: 10, practice: 0, bracket: 16, finalsBestOf: 1, joinCode: "TEST" };
  const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  return mapEvent(data);
}
export async function createVexEvent(name, adminCredential, format = "tournament") {
  await ensureAnonymousSession();
  const cleanName = String(name || "").trim();
  const cleanCredential = String(adminCredential || "").trim().toUpperCase();
  if (format === "league") {
    const { data, error } = await supabase.rpc("create_refos_vex_event_with_format", {
      p_name: cleanName,
      p_admin_credential: cleanCredential,
      p_format: "league",
    });
    if (error) {
      if (/create_refos_vex_event_with_format/i.test(error.message || "")) throw new Error("League events are not installed in Supabase yet. Run supabase/refos-2-league-events.sql.");
      throw error;
    }
    return mapEvent(Array.isArray(data) ? data[0] : data);
  }
  const { data, error } = await supabase.rpc("create_refos_vex_event", {
    p_name: cleanName,
    p_admin_credential: cleanCredential,
  });
  if (error) throw error;
  return mapEvent(Array.isArray(data) ? data[0] : data);
}

/* ================= League sessions (refos-2-league-events.sql) ================= */
const mapLeagueSession = (r) => r && ({
  id: r.id,
  eventId: r.event_id,
  name: r.name || "",
  type: r.session_type === "finals" ? "finals" : "session",
  order: Number(r.ord) || 0,
  date: r.session_date || "",
  startTime: r.start_time ? String(r.start_time).slice(0, 5) : "",
  endTime: r.end_time ? String(r.end_time).slice(0, 5) : "",
  status: ["active", "completed"].includes(r.status) ? r.status : "upcoming",
  startedAt: r.started_at || null,
  completedAt: r.completed_at || null,
  converted: r.origin === "converted",
});
export async function listLeagueSessions(eventId) {
  if (E2E_MOCK) return [];
  try {
    const { data, error } = await supabase.from("league_sessions").select("*").eq("event_id", eventId).order("ord").order("created_at");
    if (error) throw error;
    const sessions = (data || []).map(mapLeagueSession);
    saveReadCache(eventId, "league_sessions", sessions);
    return sessions;
  } catch (error) {
    const cached = loadReadCache(eventId, "league_sessions");
    if (cached) return cached;
    throw error;
  }
}
const leagueSessionArgs = (s) => ({
  p_name: String(s.name || "").trim(),
  p_type: s.type === "finals" ? "finals" : "session",
  p_date: s.date || null,
  p_start: s.startTime || null,
  p_end: s.endTime || null,
});
export async function createLeagueSession(eventId, session) {
  const { data, error } = await supabase.rpc("create_league_session", { p_event: eventId, ...leagueSessionArgs(session) });
  if (error) throw error;
  return mapLeagueSession(Array.isArray(data) ? data[0] : data);
}
export async function updateLeagueSession(sessionId, session) {
  const { data, error } = await supabase.rpc("update_league_session", { p_session: sessionId, ...leagueSessionArgs(session) });
  if (error) throw error;
  return mapLeagueSession(Array.isArray(data) ? data[0] : data);
}
export async function reorderLeagueSessions(eventId, orderedIds) {
  const { error } = await supabase.rpc("reorder_league_sessions", { p_event: eventId, p_order: orderedIds });
  if (error) throw error;
}
// status: "active" (Start Session), "completed" (Complete Session) or "upcoming".
export async function setLeagueSessionStatus(sessionId, status) {
  const { data, error } = await supabase.rpc("set_league_session_status", { p_session: sessionId, p_status: status });
  if (error) throw error;
  return mapLeagueSession(Array.isArray(data) ? data[0] : data);
}
export async function leagueSessionRecordCounts(sessionId) {
  const { data, error } = await supabase.rpc("league_session_record_counts", { p_session: sessionId });
  if (error) throw error;
  return data || {};
}
// Resolves { status: "deleted" | "confirm_required", counts }. A session that holds records is
// deleted only when confirmName matches its name exactly. Photo files are removed afterwards.
export async function deleteLeagueSession(sessionId, confirmName = null) {
  const { data, error } = await supabase.rpc("delete_league_session", { p_session: sessionId, p_confirm_name: confirmName });
  if (error) throw error;
  const result = data || {};
  const paths = Array.isArray(result.paths) ? result.paths : [];
  for (let i = 0; i < paths.length; i += 100) {
    const { error: storageError } = await supabase.storage.from("robot-photos").remove(paths.slice(i, i + 100));
    if (storageError) console.warn("Session deleted; some photo files still need cleanup.", storageError);
  }
  if (paths.length) await deleteCachedPhotos(paths).catch(() => {});
  return { status: result.status || "", counts: result.counts || {} };
}
/* ---- Tournament -> League conversion (one way; server-side, one transaction) ---- */
// Real counts of what would move into the first session, and what stays league-wide.
export async function tournamentConversionPreview(eventId) {
  const { data, error } = await supabase.rpc("tournament_conversion_preview", { p_event: eventId });
  if (error) throw error;
  return data || {};
}
// Resolves { status: "converted" | "already_league" | "name_mismatch", sessionId, moved }.
export async function convertTournamentToLeague(eventId, { confirmName, sessionName = "Session 1", sessionDate = null }) {
  const { data, error } = await supabase.rpc("convert_refos_tournament_to_league", {
    p_event: eventId,
    p_confirm_name: String(confirmName ?? ""),
    p_session_name: String(sessionName || "").trim() || "Session 1",
    p_session_date: sessionDate || null,
  });
  if (error) {
    if (/convert_refos_tournament_to_league/i.test(error.message || "")) throw new Error("League events are not installed in Supabase yet. Run supabase/refos-2-league-events.sql.");
    throw error;
  }
  const result = data || {};
  return { status: result.status || "", sessionId: result.session_id || null, moved: result.moved || {} };
}
// Where a write queued on this device WITHOUT a session belongs (used by the outbox):
//   { sessionId: null }  Tournament (or League never converted): upload unchanged.
//   { sessionId: id }    a converted League: the write was made while it was still a Tournament,
//                        or before this device noticed, while the first session is still Active.
//   { hold: message }    anything else: kept for review instead of guessing.
// Read fresh every time (not cached): the answer depends on which session is Active right now.
async function conversionInfo(eventId) {
  const { data: ev, error } = await supabase.from("events").select("event_format,converted_to_league_at").eq("id", eventId).maybeSingle();
  if (error) throw error;
  let info = { format: ev?.event_format === "league" ? "league" : "tournament", convertedAt: ev?.converted_to_league_at ? Date.parse(ev.converted_to_league_at) : null, session: null };
  if (info.format === "league" && info.convertedAt) {
    const { data: sessions, error: sessionError } = await supabase.from("league_sessions").select("id,status,origin").eq("event_id", eventId);
    if (sessionError) throw sessionError;
    info.session = (sessions || []).find((s) => s.origin === "converted") || null;
  }
  return info;
}
export async function queuedRecordSession(eventId, createdAt) {
  if (E2E_MOCK) return { sessionId: null };
  const info = await conversionInfo(eventId);
  if (info.format !== "league" || !info.convertedAt) return { sessionId: null };
  if (!info.session) return { hold: "Held for review: this was saved while the event was a Tournament, and its first league session no longer exists." };
  if (Number(createdAt) && Number(createdAt) <= info.convertedAt) return { sessionId: info.session.id };
  if (info.session.status === "active") return { sessionId: info.session.id };
  return { hold: "Held for review: saved without a league session after this event became a League, and its first session is no longer Active. An Admin can discard it or re-enter it in the right session." };
}

const mapAttendance = (r) => ({ sessionId: r.session_id, team: r.team, status: r.status, by: r.updated_by || "", updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : 0 });
// Attendance for one session (sessionId) or for every session of the league (no sessionId).
export async function listLeagueAttendance(eventId, sessionId = null) {
  if (E2E_MOCK) return [];
  let query = supabase.from("league_session_attendance").select("*").eq("event_id", eventId);
  if (sessionId) query = query.eq("session_id", sessionId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapAttendance);
}
// status: "present", "absent", or null to clear.
export async function setLeagueAttendance(eventId, sessionId, team, status, by = "") {
  const number = String(team || "").trim().toUpperCase();
  if (!status) {
    const { error } = await supabase.from("league_session_attendance").delete().eq("event_id", eventId).eq("session_id", sessionId).eq("team", number);
    if (error) throw error;
    return null;
  }
  const row = { event_id: eventId, session_id: sessionId, team: number, status, updated_by: by || "", updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("league_session_attendance").upsert(row, { onConflict: "event_id,session_id,team" }).select().single();
  if (error) throw error;
  return mapAttendance(data);
}
export async function createEvent(d) {
  await ensureAnonymousSession();
  const { data, error } = await supabase.rpc("create_configured_event", {
    p_name: d.name, p_quals: d.quals, p_practice: d.practice, p_bracket: d.bracket, p_finals: d.finalsBestOf,
    p_admin_credential: d.adminCredential, p_builder_code: d.builderCode,
  });
  if (error) throw error;
  return mapEvent(Array.isArray(data) ? data[0] : data);
}
export async function deleteConfiguredEvent(eventId, builderCode) {
  await ensureAnonymousSession();
  const { data, error } = await supabase.rpc("delete_configured_event", {
    p_event: eventId, p_builder_code: builderCode,
  });
  if (error) throw error;
  return data === true;
}

export async function verifyEventConfigurator(code) {
  await ensureAnonymousSession();
  const { data, error } = await supabase.rpc("verify_event_configurator", { p_builder_code: code });
  if (error) throw error;
  return data === true;
}
export async function updateEvent(id, d) {
  const { data } = await supabase.from("events").update({
    name: d.name, quals: d.quals, practice: d.practice, bracket: d.bracket, finals_best_of: d.finalsBestOf,
  }).eq("id", id).select().single();
  return mapEvent(data);
}
export async function joinEventByCode(code) {
  const { data, error } = await supabase.rpc("join_event_by_code", { p_code: code.trim().toUpperCase() });
  if (error) throw error;
  return mapEvent(Array.isArray(data) ? data[0] : data);
}
export async function regenerateJoinCode(eventId) {
  const code = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  const { data, error } = await supabase.from("events").update({ join_code: code }).eq("id", eventId).select().single();
  if (error) throw error;
  return mapEvent(data);
}
export async function listMembers(eventId) {
  const { data } = await supabase.from("event_members").select("name,user_id").eq("event_id", eventId);
  return (data || []).map((m) => ({ name: m.name || "—", userId: m.user_id }));
}

/* ================= teams ================= */
const mapTeam = (r) => ({ number: r.number, name: r.name || "", rank: r.rank == null ? null : Number(r.rank), photoKeys: r.photo_paths || [], createdAt: new Date(r.created_at).getTime() });
/* ================= offline read cache =================
   Last successful Teams and Matches reads are kept per event so field refs
   can continue working through a temporary network/Supabase outage. */
const readCacheKey = (eventId, kind) => `refosReadCache:${eventId}:${kind}`;
function loadReadCache(eventId, kind) {
  try {
    const raw = localStorage.getItem(readCacheKey(eventId, kind));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.data) ? parsed.data : null;
  } catch {
    return null;
  }
}
function saveReadCache(eventId, kind, data) {
  try {
    localStorage.setItem(readCacheKey(eventId, kind), JSON.stringify({
      savedAt: Date.now(),
      data: Array.isArray(data) ? data : [],
    }));
  } catch {}
}

export async function listTeams(eventId) {
  if (E2E_MOCK) return e2eState.teams.map((t) => ({ ...t }));
  const sessionId = leagueSessionFor(eventId);
  const cacheKind = sessionId ? `teams@${sessionId}` : "teams";
  try {
    const { data, error } = await supabase.from("teams").select("*").eq("event_id", eventId);
    if (error) throw error;
    let teams = (data || []).map(mapTeam);
    if (sessionId) {
      // League: teams are league-wide; the rank comes from this session's imported ranking
      // snapshot, and the robot photos shown are this session's (all sessions kept in allPhotoKeys).
      const snapshot = await supabase.from("event_settings").select("value").eq("event_id", eventId).eq("key", leagueSettingKey("rank_snapshot", sessionId)).maybeSingle();
      const ranks = snapshot.data?.value?.ranks || {};
      teams = teams.map((team) => ({
        ...team,
        rank: ranks[team.number] == null ? null : Number(ranks[team.number]),
        allPhotoKeys: team.photoKeys,
        photoKeys: viewPhotoKeys(eventId, team.photoKeys),
      }));
    }
    saveReadCache(eventId, cacheKind, teams);
    return teams;
  } catch (error) {
    // A converted League's first session can still use the Tournament-era offline copy.
    const cached = loadReadCache(eventId, cacheKind) || (sessionId && sessionId === leagueLegacySessionFor(eventId) ? loadReadCache(eventId, "teams") : null);
    if (cached) {
      console.warn("Teams unavailable from Supabase; using last synced local cache.", error);
      return cached;
    }
    throw error;
  }
}
export async function upsertTeam(eventId, number, name) {
  const num = (number || "").trim().toUpperCase();
  if (E2E_MOCK) {
    if (!num) return num;
    const existing = e2eState.teams.find((t) => t.number === num);
    if (existing) {
      if (name && name.trim()) existing.name = name.trim();
    } else {
      e2eState.teams.push({ number: num, name: (name || "").trim(), rank: null, photoKeys: [], createdAt: Date.now() });
    }
    return num;
  }
  if (!num) return num;
  const hasName = !!(name && name.trim());
  const payload = { event_id: eventId, number: num };
  if (hasName) payload.name = name.trim();
  const { error } = await supabase.from("teams").upsert(payload, { onConflict: "event_id,number", ignoreDuplicates: !hasName });
  if (error) throw error;
  return num;
}

/* ---- team watchlist notes (multiple refs per team) ---- */
const mapWatch = (r) => ({ id: r.id, team: r.team, by: r.ref_name || "", note: r.note || "", createdAt: new Date(r.created_at).getTime() });
export async function listWatchNotes(eventId) {
  if (E2E_MOCK) return [];
  const { data } = await supabase.from("watch_notes").select("*").eq("event_id", eventId).order("created_at");
  return (data || []).map(mapWatch);
}

export async function clearWatchNotes(eventId) {
  const { error } = await supabase.from("watch_notes").delete().eq("event_id", eventId);
  if (error) throw error;
}

export async function addWatchNote(eventId, w) {
  const id = (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) || Math.random().toString(36).slice(2);
  const row = { id, event_id: eventId, team: (w.team || "").trim().toUpperCase(), ref_name: w.by || "", note: (w.note || "").trim() };
  const { data, error } = await supabase.from("watch_notes").upsert(row, { onConflict: "id" }).select().single();
  if (error) throw error;
  return mapWatch(data);
}
export async function deleteWatchNote(id) {
  const { error } = await supabase.from("watch_notes").delete().eq("id", id);
  if (error) throw error;
}

export async function bulkUpsertTeams(eventId, teams) {
  const rows = teams
    .map((t) => ({ number: (t.number || "").trim().toUpperCase(), name: (t.name || "").trim() || null }))
    .filter((t) => t.number)
    .map((t) => ({ event_id: eventId, number: t.number, name: t.name }));
  if (!rows.length) return 0;
  const { error } = await supabase.from("teams").upsert(rows, { onConflict: "event_id,number" });
  if (error) throw error;
  return rows.length;
}
export async function bulkUpsertRankings(eventId, rankings) {
  const rows = rankings
    .map((r) => ({ event_id: eventId, number: (r.number || "").trim().toUpperCase(), rank: Number(r.rank) }))
    .filter((r) => r.number && Number.isFinite(r.rank) && r.rank > 0);
  if (!rows.length) return 0;
  if (leagueSessionFor(eventId)) {
    // League: the imported rankings are stored as THIS session's snapshot (earlier sessions keep
    // theirs). Teams stay league-wide; missing teams are added without a rank.
    const { error: teamError } = await supabase.from("teams").upsert(rows.map((r) => ({ event_id: eventId, number: r.number })), { onConflict: "event_id,number", ignoreDuplicates: true });
    if (teamError) throw teamError;
    await upsertEventSetting(eventId, "rank_snapshot", { ranks: Object.fromEntries(rows.map((r) => [r.number, r.rank])), importedAt: Date.now() });
    return rows.length;
  }
  const { error } = await supabase.from("teams").upsert(rows, { onConflict: "event_id,number" });
  if (error) throw error;
  return rows.length;
}
export async function deleteTeam(eventId, number) {
  const { data: vs } = await supabase.from("violations").select("photo_paths").eq("event_id", eventId).eq("team", number);
  const paths = (vs || []).flatMap((v) => v.photo_paths || []);
  if (paths.length) await supabase.storage.from("robot-photos").remove(paths);
  await supabase.from("violations").delete().eq("event_id", eventId).eq("team", number);
  await supabase.from("teams").delete().eq("event_id", eventId).eq("number", number);
  if (leagueSessionFor(eventId)) await supabase.from("league_session_attendance").delete().eq("event_id", eventId).eq("team", number);
}

/* ---- robot inspection photos (stored on the team) ---- */
const robotGenerationCacheKey = (eventId) => `refos:robot-photo-generation:${eventId}`;
export async function getRobotPhotoGeneration(eventId, allowCached = false) {
  if (E2E_MOCK) return e2eRobotGeneration;
  try {
    const { data, error } = await supabase.rpc("robot_photo_generation", { p_event: eventId });
    if (error) throw error;
    const generation = String(data || "0");
    localStorage.setItem(robotGenerationCacheKey(eventId), generation);
    return generation;
  } catch (error) {
    if (allowCached && (typeof navigator !== "undefined" && !navigator.onLine || /failed to fetch|network|timeout/i.test(error?.message || ""))) {
      return localStorage.getItem(robotGenerationCacheKey(eventId)) || "0";
    }
    throw error;
  }
}
// Robot photo cloud path: <event-id>/team/<TEAM>/<angle>-<upload-id>.<webp|jpg>
// Event-prefixed so event isolation and event cleanup can identify every object safely.
// The extension follows the compressed image type (WebP, or JPEG where WebP encoding is unavailable).
const ROBOT_PHOTO_ANGLES = ["front", "back", "side", "tag", "lexan"];
export const robotPhotoAngleKey = (angle) => (ROBOT_PHOTO_ANGLES.includes(String(angle).toLowerCase()) ? String(angle).toLowerCase() : "other");
// League sessions add a session folder so each session keeps its own inspection evidence:
// <event-id>/team/<TEAM>/s-<session-id>/<angle>-<upload-id>.<webp|jpg>
export function robotPhotoPath(eventId, number, angle, id, mime = "image/jpeg", sessionId = leagueSessionFor(eventId)) {
  const num = String(number || "").trim().toUpperCase();
  const ext = /webp/i.test(String(mime)) ? "webp" : "jpg";
  const sessionFolder = sessionId ? `s-${sessionId}/` : "";
  return `${eventId}/team/${num}/${sessionFolder}${robotPhotoAngleKey(angle)}-${id}.${ext}`;
}
const dataUrlMimeType = (dataUrl) => (String(dataUrl).match(/^data:([^;,]+)/) || [])[1] || "image/jpeg";
const pathAngle = (path) => (String(path || "").match(/\/(front|back|side|tag|lexan|other)-[^/]+\.(?:jpe?g|webp)$/i) || [])[1]?.toLowerCase() || "";

export async function addTeamPhoto(eventId, number, dataUrl, angle = "other", uploadId = "", generation = "0", photoSessionIdArg) {
  // A queued photo keeps the session it was taken in (photoSessionIdArg), even if this device has
  // moved to another session before the upload runs. Older queued photos use the current session.
  const sessionId = photoSessionIdArg === undefined ? leagueSessionFor(eventId) : (photoSessionIdArg || null);
  const currentGeneration = await getRobotPhotoGeneration(eventId);
  if (currentGeneration !== generation) return null;
  const num = (number || "").trim().toUpperCase();
  const safeAngle = robotPhotoAngleKey(angle);
  const id = uploadId || ((self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) || Math.random().toString(36).slice(2));
  const mime = dataUrlMimeType(dataUrl);
  const path = robotPhotoPath(eventId, num, safeAngle, id, mime, sessionId);
  const blob = dataURLtoBlob(dataUrl);
  const up = await supabase.storage.from("robot-photos").upload(path, blob, { contentType: mime, upsert: true });
  if (up.error) throw up.error;
  const { data: paths, error } = await supabase.rpc("append_team_photo_path", { p_event: eventId, p_team: num, p_path: path, p_generation: generation });
  if (error) {
    await supabase.storage.from("robot-photos").remove([path]);
    if (/before the latest reset/i.test(error.message || "")) return null;
    throw error;
  }
  // Cache the uploaded copy locally so this device never downloads its own photo again.
  await putCachedBlob(path, blob);
  // Replacement: once the new photo is committed, remove older photos for the same angle
  // (cloud object, shared reference, and local cache). "Other" pictures are never replaced.
  let current = paths || [];
  if (safeAngle !== "other") {
    // Only photos of the same session are replaced; earlier sessions' evidence is never overwritten.
    const older = current.filter((existing) => existing !== path && pathAngle(existing) === safeAngle && photoSessionFor(eventId, existing) === (sessionId || null));
    for (const oldPath of older) {
      try { current = await removeTeamPhoto(eventId, num, oldPath); }
      catch (cleanupError) { console.warn("Older robot photo could not be removed yet", cleanupError); }
    }
  }
  return viewPhotoKeys(eventId, current);
}
export async function removeTeamPhoto(eventId, number, path) {
  const num = (number || "").trim().toUpperCase();
  const { data: paths, error } = await supabase.rpc("remove_team_photo_path", { p_event: eventId, p_team: num, p_path: path });
  if (error) throw error;
  const { error: storageError } = await supabase.storage.from("robot-photos").remove([path]);
  if (storageError) throw storageError;
  await deleteCachedPhotos([path]);
  return viewPhotoKeys(eventId, paths || []);
}
// Removes cloud photo objects for permanently deleted events. Runs server-side in the
// purge-deleted-event-photos Edge Function; no service-role key exists in the browser.
export async function purgeDeletedEventPhotos() {
  if (E2E_MOCK) return { purged: [] };
  const { data, error } = await supabase.functions.invoke("purge-deleted-event-photos", { body: {} });
  if (error) throw error;
  return data;
}
export async function resetTeamPhotos(eventId, { allSessions = false } = {}) {
  if (E2E_MOCK) {
    e2eState.teams = e2eState.teams.map((team) => ({ ...team, photoKeys: [] }));
    e2eRobotGeneration = uid();
    return { version: e2eRobotGeneration, paths: [] };
  }
  const sessionId = leagueSessionFor(eventId);
  if (sessionId && !allSessions) {
    // League: Clear Data removes only this session's inspection photos; earlier sessions keep theirs.
    const { data: teamRows, error: teamError } = await supabase.from("teams").select("number,photo_paths").eq("event_id", eventId);
    if (teamError) throw teamError;
    const paths = [];
    for (const team of teamRows || []) {
      for (const path of viewPhotoKeys(eventId, team.photo_paths || [])) {
        const { error: removeError } = await supabase.rpc("remove_team_photo_path", { p_event: eventId, p_team: team.number, p_path: path });
        if (removeError) throw removeError;
        paths.push(path);
      }
    }
    return { league: true, version: null, paths };
  }
  const { data, error } = await supabase.rpc("reset_event_robot_photos", { p_event: eventId });
  if (error) throw error;
  localStorage.setItem(robotGenerationCacheKey(eventId), data.version);
  return data;
}
export async function finishTeamPhotoCleanup(eventId, reset) {
  if (E2E_MOCK) return;
  const paths = reset.paths || [];
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from("robot-photos").remove(paths.slice(i, i + 100));
    if (error) throw error;
  }
  if (reset.league) { await deleteCachedPhotos(paths).catch(() => {}); return; }
  const { error } = await supabase.rpc("finish_robot_photo_cleanup", { p_event: eventId, p_version: reset.version });
  if (error) throw error;
}

/* ================= matches (qualification schedule) ================= */
export async function listMatches(eventId) {
  if (E2E_MOCK) return [];
  const sessionId = leagueSessionFor(eventId);
  const cacheKind = sessionId ? `matches@${sessionId}` : "matches";
  try {
    let query = supabase.from("matches").select("num,red,blue,field,phase,label,winner,red_score,blue_score").eq("event_id", eventId);
    // League: only this session's schedule. Match numbers repeat between sessions (Session 1 Q1,
    // Session 2 Q1), and within one session they are unique, so match ids below stay unique.
    if (sessionId) query = query.eq("session_id", sessionId);
    const { data, error } = await query.order("num");
    if (error) throw error;
    const matches = (data || []).map((m) => {
      const phase = m.phase || "qual";
      return { id: phase === "qual" ? String(m.num) : `${phase}-${m.num}`, phase, num: m.num, label: m.label || "", winner: m.winner || "", redScore: m.red_score, blueScore: m.blue_score, red: m.red || [], blue: m.blue || [], field: m.field || "" };
    });
    saveReadCache(eventId, cacheKind, matches);
    return matches;
  } catch (error) {
    const cached = loadReadCache(eventId, cacheKind) || (sessionId && sessionId === leagueLegacySessionFor(eventId) ? loadReadCache(eventId, "matches") : null);
    if (cached) {
      console.warn("Matches unavailable from Supabase; using last synced local cache.", error);
      return cached;
    }
    throw error;
  }
}
export async function addMatch(eventId, m) {
  const row = { event_id: eventId, phase: m.phase || "qual", num: Number(m.num), red: m.red || [], blue: m.blue || [], field: m.field || null, label: m.label || null };
  if (m.redScore != null) row.red_score = Number(m.redScore);
  if (m.blueScore != null) row.blue_score = Number(m.blueScore);
  if (m.winner) row.winner = m.winner;
  const sessionId = leagueSessionFor(eventId);
  if (sessionId) row.session_id = sessionId;
  // Re-importing a match updates that match in the same session only (event + session + phase + number).
  const { error } = await upsertSessionKeyed("matches", row, "event_id,session_key,phase,num", "event_id,phase,num", { sessionId });
  if (error) throw error;
}
// League sessions: restrict a match / alliance / check query to the current session.
const inSession = (query, eventId) => {
  const sessionId = leagueSessionFor(eventId);
  return sessionId ? query.eq("session_id", sessionId) : query;
};
export async function updateMatchScore(eventId, phase, num, redScore, blueScore, winner) {
  const { error } = await supabase
    .from("matches")
    .update({
      red_score: redScore != null ? Number(redScore) : null,
      blue_score: blueScore != null ? Number(blueScore) : null,
      winner: winner || null,
    })
    .eq("event_id", eventId)
    .eq("phase", phase)
    .eq("num", Number(num))
    .match(leagueSessionFor(eventId) ? { session_id: leagueSessionFor(eventId) } : {});
  if (error) throw error;
}

export async function setMatchWinner(eventId, phase, num, winner) {
  const { error } = await inSession(supabase.from("matches").update({ winner: winner || null }).eq("event_id", eventId).eq("phase", phase).eq("num", Number(num)), eventId);
  if (error) throw error;
}
export async function deleteMatch(eventId, phase, num) {
  const { error } = await inSession(supabase.from("matches").delete().eq("event_id", eventId).eq("phase", phase).eq("num", Number(num)), eventId);
  if (error) throw error;
}

/* ================= event settings (shared configuration) ================= */
const mapEventSetting = (r) => ({ key: r.key, value: r.value, updatedBy: r.updated_by || "", updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : 0 });
export async function listEventSettings(eventId) {
  if (E2E_MOCK) return {};
  const { data, error } = await supabase.from("event_settings").select("*").eq("event_id", eventId);
  if (error) throw error;
  const sessionId = leagueSessionFor(eventId);
  if (!sessionId) return Object.fromEntries((data || []).map((r) => [r.key, mapEventSetting(r)]));
  // League: snapshot keys are stored per session as "<key>@<session id>". This session's value is
  // exposed under the plain key; other sessions' snapshots stay available under their full key.
  const settings = {};
  for (const r of data || []) {
    if (LEAGUE_SESSION_SETTING_KEYS.has(r.key)) continue;
    settings[r.key] = mapEventSetting(r);
  }
  for (const key of LEAGUE_SESSION_SETTING_KEYS) {
    const own = settings[leagueSettingKey(key, sessionId)];
    if (own) settings[key] = { ...own, key };
  }
  return settings;
}
const storedSettingKey = (eventId, key) => {
  const sessionId = leagueSessionFor(eventId);
  return sessionId && LEAGUE_SESSION_SETTING_KEYS.has(key) ? leagueSettingKey(key, sessionId) : key;
};
// Phase 6: the selected event's public branding ({ shortName, logoUrl, accent }), read through the
// existing list_refos_event_branding() function that already serves Choose VEX Event and the login
// screen. Used by roles that cannot read event_settings (Inspection). Returns null if unavailable.
export async function getPublicEventBranding(eventId) {
  if (E2E_MOCK) return null;
  const { data, error } = await supabase.rpc("list_refos_event_branding");
  if (error) return null;
  const row = (data || []).find((r) => r.event_id === eventId);
  if (!row) return null;
  return {
    key: "event_branding",
    value: { shortName: row.short_name || "", logoUrl: row.logo_url || "", accent: row.accent_color || "" },
    updatedBy: "",
    updatedAt: 0,
  };
}
// Phase 6: field display names only, readable by every event role including Inspection
// (supabase/refos-2-phase6-event-settings.sql). Returns null if the function is not installed.
export async function getEventCompetitionProgram(eventId) {
  if (E2E_MOCK) return null;
  try {
    const {data,error} = await supabase.rpc("get_event_competition_program", {p_event:eventId});
    if (error) throw error;
    if (!["iq","v5"].includes(data)) throw new Error("Competition program is unavailable.");
    const row = {key:"competition_program",value:{program:data},updatedAt:0,updatedBy:""};
    saveReadCache(eventId,"competition_program",[row]);
    return row;
  } catch (error) {
    const cached = loadReadCache(eventId,"competition_program")?.[0];
    if (cached) return cached;
    throw error;
  }
}
export async function getEventFieldNames(eventId) {
  if (E2E_MOCK) return null;
  const { data, error } = await supabase.rpc("get_event_field_names", { p_event: eventId });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { key: "field_names", value: row.field_names || {}, updatedBy: "", updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0 };
}
export async function getEventSetting(eventId, key) {
  const { data, error } = await supabase.from("event_settings").select("*").eq("event_id", eventId).eq("key", storedSettingKey(eventId, key)).maybeSingle();
  if (error) throw error;
  return data ? { ...mapEventSetting(data), key } : null;
}
export async function upsertEventSetting(eventId, key, value, by = "") {
  if (E2E_MOCK) return { key, value, updatedBy: by || "", updatedAt: Date.now() };
  const row = { event_id: eventId, key: storedSettingKey(eventId, key), value, updated_by: by || "", updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("event_settings").upsert(row, { onConflict: "event_id,key" }).select().single();
  if (error) throw error;
  return { ...mapEventSetting(data), key };
}
export async function deleteEventSetting(eventId, key) {
  if (E2E_MOCK) return;
  const { error } = await supabase.from("event_settings").delete().eq("event_id", eventId).eq("key", storedSettingKey(eventId, key));
  if (error) throw error;
}

/* ================= field log (timeouts / faults / replays) ================= */
const mapFieldLog = (r) => ({ id: r.id, kind: r.kind, field: r.field || "", matchRef: r.match_ref || "", matchId: r.match_id || "", alliance: r.alliance || "", team: r.team || "", teams: r.teams || [], note: r.note || "", by: r.logged_by || "", createdAt: new Date(r.created_at).getTime(), sessionId: r.session_id || null });
// League sessions: this session's entries plus league-wide ones (volunteer profiles, access-code requests).
const fieldLogInSession = (query, eventId) => {
  const sessionId = leagueSessionFor(eventId);
  return sessionId ? query.or(`session_id.eq.${sessionId},session_id.is.null`) : query;
};
export async function listFieldLog(eventId) {
  if (E2E_MOCK) return [];
  if (isVenueMode()) return venueListFieldLog(eventId);
  const { data } = await fieldLogInSession(supabase.from("field_log").select("*").eq("event_id", eventId), eventId).order("created_at", { ascending: false });
  return (data || []).map(mapFieldLog);
}
export async function addFieldLog(eventId, e) {
  const id = (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) || Math.random().toString(36).slice(2);
  const row = { id, event_id: eventId, kind: e.kind, field: e.field || null, match_ref: e.matchRef || null, match_id: e.matchId || null, alliance: e.alliance || null, team: e.team || null, teams: (e.teams && e.teams.length) ? e.teams : null, note: (e.note || "").trim(), logged_by: e.by || "" };
  const sessionId = leagueSessionFor(eventId);
  if (sessionId && !LEAGUE_EVENT_SCOPED_FIELD_LOG_KINDS.has(row.kind)) row.session_id = sessionId;
  if (isVenueMode() && !VENUE_CLOUD_ONLY_FIELD_LOG_KINDS.has(row.kind)) return venueAddFieldLog(eventId, row);
  const { data, error } = await supabase.from("field_log").upsert(row, { onConflict: "id" }).select().single();
  if (error) throw error;
  if (data.kind === "feedback") await sendRoleCodeRequestPush(data.id).catch(() => {});
  return mapFieldLog(data);
}
export async function deleteFieldLog(id) {
  if (isVenueMode() && await venueOwns("field_log", id)) return venue.write(venue.currentEventId(), "field_log", id, "delete");
  const { error } = await supabase.from("field_log").delete().eq("id", id);
  if (error) throw error;
}

/* ================= shared quadrant field reset ================= */
const mapFieldResetCheck = (r) => ({
  eventId: r.event_id,
  matchId: r.match_id,
  matchRef: r.match_ref || "",
  quadrant: Number(r.quadrant),
  verifiedBy: r.verified_by || "",
  verifiedAt: r.verified_at ? new Date(r.verified_at).getTime() : null,
  updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : null,
});

export async function listFieldResetChecks(eventId) {
  if (E2E_MOCK) return [];
  const { data, error } = await inSession(supabase
    .from("field_reset_checks")
    .select("*")
    .eq("event_id", eventId), eventId)
    .order("match_id")
    .order("quadrant");
  if (error) throw error;
  return (data || []).map(mapFieldResetCheck);
}

export async function verifyFieldResetQuadrant(eventId, matchId, matchRef, quadrant, verifiedBy = "") {
  const q = Number(quadrant);
  if (![1, 2, 3, 4].includes(q)) throw new Error("Invalid field reset quadrant.");
  if (E2E_MOCK) return { eventId, matchId, matchRef, quadrant: q, verifiedBy, verifiedAt: Date.now(), updatedAt: Date.now() };
  const now = new Date().toISOString();
  const row = {
    event_id: eventId,
    match_id: String(matchId),
    match_ref: matchRef || null,
    quadrant: q,
    verified_by: (verifiedBy || "").trim(),
    verified_at: now,
    updated_at: now,
  };
  const sessionId = leagueSessionFor(eventId);
  if (sessionId) row.session_id = sessionId;
  const { data, error } = await upsertSessionKeyed("field_reset_checks", row, "event_id,session_key,match_id,quadrant", "event_id,match_id,quadrant",
    { sessionId, finish: (q) => q.select().single() });
  if (error) throw error;
  return mapFieldResetCheck(data);
}

export async function clearFieldResetMatch(eventId, matchId) {
  if (E2E_MOCK) return;
  const { error } = await inSession(supabase
    .from("field_reset_checks")
    .delete()
    .eq("event_id", eventId)
    .eq("match_id", String(matchId)), eventId);
  if (error) throw error;
}

export async function clearFieldResetChecks(eventId) {
  if (E2E_MOCK) return;
  const { error } = await inSession(supabase.from("field_reset_checks").delete().eq("event_id", eventId), eventId);
  if (error) throw error;
}

/* ================= elimination alliances ================= */
const mapAlliance = (r) => ({ seed: r.seed, teams: r.teams || [] });
export async function listAlliances(eventId) {
  if (E2E_MOCK) return [];
  const { data } = await inSession(supabase.from("alliances").select("seed,teams").eq("event_id", eventId), eventId).order("seed");
  return (data || []).map(mapAlliance);
}
export async function upsertAlliance(eventId, seed, teams) {
  const row = { event_id: eventId, seed: Number(seed), teams: teams || [], updated_at: new Date().toISOString() };
  const sessionId = leagueSessionFor(eventId);
  if (sessionId) row.session_id = sessionId;
  const { error } = await upsertSessionKeyed("alliances", row, "event_id,session_key,seed", "event_id,seed", { sessionId });
  if (error) throw error;
}
export async function clearAlliances(eventId) {
  const { error } = await inSession(supabase.from("alliances").delete().eq("event_id", eventId), eventId);
  if (error) throw error;
}

/* ================= rulebook ================= */
export async function listRules(eventId) {
  const highlander = eventId === "11111111-1111-4111-8111-111111111111";
  if (E2E_MOCK) return highlander ? OFFLINE_RULES : [];
  try {
    const { data, error } = await supabase.from("rules").select("code,description,category,ord").eq("event_id", eventId).order("ord");
    if (error) throw error;
    const live = (data || []).map((r) => ({ code: r.code, desc: r.description || "", category: r.category || "", ord: r.ord ?? 0 }));
    saveReadCache(eventId, "rules", live);
    return live.length ? live : highlander ? OFFLINE_RULES : [];
  } catch (error) {
    console.warn("Rules unavailable from Supabase; using bundled offline rule index.", error);
    return loadReadCache(eventId, "rules") || (highlander ? OFFLINE_RULES : []);
  }
}
export async function importEventRules(eventId, rows) {
  const { error } = await supabase.from("rules").upsert(rows.map((row, index) => ({
    event_id: eventId, code: row.code, description: row.desc, category: row.category || "General", ord: index + 1,
  })), { onConflict: "event_id,code" });
  if (error) throw error;
  return listRules(eventId);
}

/* ================= award nominations (Judging) ================= */
export const decodeAttribution = (value) => {
  const raw = String(value || "");
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.v === 1 && parsed?.n) return { nickname: String(parsed.n), fullName: String(parsed.f || parsed.n) };
  } catch {}
  return { nickname: raw, fullName: raw };
};
const encodeAttribution = (nickname, fullName) => JSON.stringify({ v: 1, n: String(nickname || "").trim(), f: String(fullName || nickname || "").trim() });
const mapNom = (r) => {
  const attribution = decodeAttribution(r.nominated_by);
  return { id: r.id, award: r.award, team: r.team, match: r.match_info || null, reason: r.reason || "", criteria: r.criteria || [], whereWhen: r.where_when || "", by: attribution.nickname, byFullName: attribution.fullName, byRole: r.nominated_role || "", createdAt: new Date(r.created_at).getTime() };
};
export async function listNominations(eventId) {
  if (E2E_MOCK) return [];
  const { data } = await inSession(supabase.from("nominations").select("*").eq("event_id", eventId), eventId).order("created_at", { ascending: false });
  return (data || []).map(mapNom);
}
export async function addNomination(eventId, n) {
  const id = (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) || Math.random().toString(36).slice(2);
  const cleanMatch = n.match && n.match.phase && n.match.phase !== "none" ? { phase: n.match.phase, num: (n.match.num || "").trim() } : null;
  const row = { id, event_id: eventId, award: n.award, team: (n.team || "").trim().toUpperCase(), match_info: cleanMatch, reason: (n.reason || "").trim(), criteria: (n.criteria && n.criteria.length) ? n.criteria : null, where_when: (n.whereWhen || "").trim() || null, nominated_by: encodeAttribution(n.by, n.byFullName), nominated_role: n.byRole || null };
  if (leagueSessionFor(eventId)) row.session_id = leagueSessionFor(eventId);
  const { data, error } = await supabase.from("nominations").upsert(row, { onConflict: "id" }).select().single();
  if (error) throw error;
  return mapNom(data);
}
export async function deleteNomination(id) {
  await supabase.from("nominations").delete().eq("id", id);
}
export async function clearJudging(eventId) {
  const { error: nomError } = await inSession(supabase.from("nominations").delete().eq("event_id", eventId), eventId);
  if (nomError) throw nomError;
  const { error: shortlistError } = await inSession(supabase.from("shortlist").delete().eq("event_id", eventId), eventId);
  if (shortlistError) throw shortlistError;
}


/* ---- award shortlist / finalists ---- */
export async function listShortlist(eventId) {
  if (E2E_MOCK) return [];
  const { data } = await inSession(supabase.from("shortlist").select("award,team").eq("event_id", eventId), eventId);
  return (data || []).map((r) => ({ award: r.award, team: r.team }));
}
export async function setShortlist(eventId, award, team, on) {
  if (on) {
    const sessionId = leagueSessionFor(eventId);
    const row = { event_id: eventId, award, team };
    if (sessionId) row.session_id = sessionId;
    const { error } = await upsertSessionKeyed("shortlist", row, "event_id,session_key,award,team", "event_id,award,team", { sessionId });
    if (error) throw error;
  } else {
    const { error } = await inSession(supabase.from("shortlist").delete().eq("event_id", eventId).eq("award", award).eq("team", team), eventId);
    if (error) throw error;
  }
}

/* ================= violations ================= */
const mapViol = (r) => {
  const attribution = decodeAttribution(r.logged_by);
  return {
    id: r.id, team: r.team, type: r.type, code: r.code, desc: r.rule_desc || "",
    notes: r.notes || "", match: r.match_info || null, by: attribution.nickname, byFullName: attribution.fullName, byUserId: r.logged_by_user || null,
    photoKeys: r.photo_paths || [], createdAt: new Date(r.created_at).getTime(),
    sessionId: r.session_id || null,
  };
};
export async function listViolations(eventId) {
  if (E2E_MOCK) return e2eState.violations.map((v) => ({ ...v }));
  if (isVenueMode()) return venueListViolations(eventId);
  const { data } = await inSession(supabase.from("violations").select("*").eq("event_id", eventId), eventId).order("created_at", { ascending: false });
  return (data || []).map(mapViol);
}
// League team history: every session's violations (each carries sessionId). History only; the
// current session's own list (listViolations) is what drives escalation and match views.
export async function listLeagueViolations(eventId, team = "") {
  if (E2E_MOCK) return [];
  const number = String(team || "").trim().toUpperCase();
  let query = supabase.from("violations").select("*").eq("event_id", eventId);
  if (number) query = query.eq("team", number);
  const cloud = isVenueMode()
    ? await cloudRowsOrSnapshot(eventId, `violation-league-${number || "all"}`, () => query.order("created_at", { ascending: false }))
    : ((await query.order("created_at", { ascending: false })).data || []);
  const byId = new Map(cloud.map((r) => [r.id, { ...mapViol(r), _source: "cloud" }]));
  if (isVenueMode()) {
    const local = await venue.list(eventId, "violation");
    for (const id of local.deletedIds) byId.delete(id);
    for (const rec of local.records) if (!number || rec.data?.team === number) byId.set(rec.recordId, venueViolation(rec));
  }
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}
// Build the DB row (with a client-generated UUID) without touching the network.
// The UUID lets us show the violation immediately and retry the write idempotently.
export function buildViolationRow(eventId, v) {
  return {
    id: uid(), event_id: eventId, team: v.team, type: v.type, code: v.code,
    rule_desc: v.desc, notes: v.notes, match_info: v.match, logged_by: encodeAttribution(v.by, v.byFullName), logged_by_user: v.byUserId,
    // League: stamped when the violation is logged, so a queued violation keeps its session.
    ...(leagueSessionFor(eventId) ? { session_id: leagueSessionFor(eventId) } : {}),
  };
}
// Upload photos then upsert the row. Safe to call more than once for the same
// row (same id) — a retry after a lost ack just overwrites identically.
export async function addViolationRow(eventId, row, photoDataUrls = []) {
  if (!E2E_MOCK && isVenueMode()) return venueSaveViolation(eventId, row, photoDataUrls);
  if (E2E_MOCK) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw new TypeError("Failed to fetch");
    if (String(row.rule_desc || "").includes("PERMANENT_FAIL")) throw new Error("E2E simulated RLS rejection");
    const saved = {
      id: row.id,
      team: row.team,
      type: row.type,
      code: row.code,
      desc: row.rule_desc || "",
      notes: row.notes || "",
      match: row.match_info || null,
      by: decodeAttribution(row.logged_by).nickname,
      byFullName: decodeAttribution(row.logged_by).fullName,
      byUserId: row.logged_by_user,
      photoKeys: [],
      createdAt: Date.now(),
    };
    const idx = e2eState.violations.findIndex((v) => v.id === saved.id);
    if (idx >= 0) e2eState.violations[idx] = saved;
    else e2eState.violations.unshift(saved);
    return saved;
  }
  const paths = [];
  for (let i = 0; i < photoDataUrls.length; i++) {
    const path = `${eventId}/${row.id}/${i}.jpg`;
    const { error } = await supabase.storage.from("robot-photos")
      .upload(path, dataURLtoBlob(photoDataUrls[i]), { contentType: "image/jpeg", upsert: true });
    if (error) throw error;        // offline -> thrown/caught as retryable by the outbox
    paths.push(path);
  }
  const { data, error } = await supabase.from("violations")
    .upsert({ ...row, photo_paths: paths }, { onConflict: "id" })
    .select().single();
  if (error) throw error;
  return mapViol(data);
}
export async function addViolation(eventId, v, photoDataUrls) {
  return addViolationRow(eventId, buildViolationRow(eventId, v), photoDataUrls);
}
// Edit an existing violation. keepKeys = existing photo paths to retain;
// newPhotoDataUrls = freshly added photos to upload; dropped keys are deleted from storage.
export async function updateViolation(eventId, row, keepKeys = [], newPhotoDataUrls = [], allOldKeys = []) {
  if (isVenueMode() && await venueOwns("violation", row.id, eventId)) return venueSaveViolation(eventId, row, newPhotoDataUrls, { edit: true });
  const removed = allOldKeys.filter((k) => !keepKeys.includes(k));
  const paths = [...keepKeys];
  for (let i = 0; i < newPhotoDataUrls.length; i++) {
    const path = `${eventId}/${row.id}/e${Date.now()}-${i}.jpg`;
    const { error } = await supabase.storage.from("robot-photos").upload(path, dataURLtoBlob(newPhotoDataUrls[i]), { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
    paths.push(path);
  }
  const { data, error } = await supabase.from("violations").upsert({ ...row, photo_paths: paths }, { onConflict: "id" }).select().single();
  if (error) throw error;
  if (removed.length) {
    const { error: cleanupError } = await supabase.storage.from("robot-photos").remove(removed);
    if (cleanupError) console.warn("Violation updated; old photo cleanup needs attention.", cleanupError);
  }
  return mapViol(data);
}
export async function deleteViolation(v) {
  if (E2E_MOCK) {
    e2eState.violations = e2eState.violations.filter((x) => x.id !== v.id);
    return;
  }
  if (isVenueMode() && (v._source === "venue" || await venueOwns("violation", v.id))) {
    await venue.write(venue.currentEventId(), "violation", v.id, "delete");
    return;
  }
  const { error } = await supabase.from("violations").delete().eq("id", v.id);
  if (error) throw error;
  const { data: remaining, error: verifyError } = await supabase.from("violations").select("id").eq("id", v.id).limit(1);
  if (verifyError) throw verifyError;
  if (remaining?.length) throw new Error("The violation is still stored in the cloud. Please try Undo again.");
  if (v.photoKeys?.length) {
    const { error: storageError } = await supabase.storage.from("robot-photos").remove(v.photoKeys);
    if (storageError) console.warn("Violation deleted; photo cleanup needs attention.", storageError);
  }
}
export async function clearViolations(eventId) {
  if (E2E_MOCK) { e2eState.violations = []; return; }
  const { data: vs } = await inSession(supabase.from("violations").select("photo_paths").eq("event_id", eventId), eventId);
  const paths = (vs || []).flatMap((v) => v.photo_paths || []);
  if (paths.length) await supabase.storage.from("robot-photos").remove(paths);
  await inSession(supabase.from("violations").delete().eq("event_id", eventId), eventId);
}
export async function clearTeams(eventId) {
  if (E2E_MOCK) { e2eState.teams = []; return; }
  const { error } = await supabase.from("teams").delete().eq("event_id", eventId);
  if (error) throw error;
}
export async function clearMatches(eventId) {
  await inSession(supabase.from("matches").delete().eq("event_id", eventId), eventId);
}
export async function clearRankings(eventId) {
  if (leagueSessionFor(eventId)) return deleteEventSetting(eventId, "rank_snapshot");
  const { error } = await supabase.from("teams").update({ rank: null }).eq("event_id", eventId);
  if (error) throw error;
}

/* ================= photos ================= */
export async function photoUrl(path) {
  if (E2E_MOCK) return null;
  const { data, error } = await supabase.storage.from("robot-photos").createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}
function dataURLtoBlob(dataURL) {
  const [meta, b64] = dataURL.split(",");
  const mime = (meta.match(/:(.*?);/) || [])[1] || "image/jpeg";
  const bin = atob(b64), len = bin.length, arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/* ================= realtime ================= */
export function subscribeEvent(eventId, onChange) {
  if (E2E_MOCK) return () => {};
  if (isVenueMode()) {
    // Cloud changes still arrive when the internet is up; venue changes arrive from the venue server.
    const offCloud = subscribeCloudEvent(eventId, onChange);
    const offVenue = venue.subscribe(eventId, () => onChange({ source: "venue" }));
    return () => { offCloud(); offVenue(); };
  }
  return subscribeCloudEvent(eventId, onChange);
}
function subscribeCloudEvent(eventId, onChange) {
  const ch = supabase
    .channel(`event-${eventId}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "violations", filter: `event_id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "violations", filter: `event_id=eq.${eventId}` }, onChange)
    // DELETE payloads may only contain the primary key, so filtering them by event_id prevents other devices from seeing the deletion.
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "violations" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `event_id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "nominations", filter: `event_id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "shortlist", filter: `event_id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "watch_notes", filter: `event_id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `event_id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "field_log", filter: `event_id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "field_reset_checks", filter: `event_id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "event_settings", filter: `event_id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "alliances", filter: `event_id=eq.${eventId}` }, onChange);
  // League events only (these tables exist once refos-2-league-events.sql has run).
  if (leagueSessionFor(eventId)) {
    ch.on("postgres_changes", { event: "*", schema: "public", table: "league_sessions", filter: `event_id=eq.${eventId}` }, (payload) => onChange({ ...payload, leagueSessions: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "league_session_attendance", filter: `event_id=eq.${eventId}` }, (payload) => onChange({ ...payload, leagueAttendance: true }));
  }
  ch.subscribe();
  return () => supabase.removeChannel(ch);
}

/* live presence — who's currently on the log. onChange gets an array of {name, ...} */
export async function listRefRoster(eventId) {
  if (E2E_MOCK) return [];
  if (isVenueMode()) return venueListRoster(eventId);
  const { data, error } = await supabase.from("ref_roster").select("name,last_seen,role").eq("event_id", eventId).order("name");
  if (error) { console.warn("Could not load ref roster", error); return []; }
  return (data || []).map((r) => ({ name: r.name, lastSeen: r.last_seen ? new Date(r.last_seen).getTime() : 0, role: r.role || "" }));
}

export async function touchRefRoster(eventId, name, role) {
  if (E2E_MOCK) return undefined;
  const clean = (name || "Ref").trim();
  if (!clean) return;
  if (isVenueMode()) { await venue.write(eventId, "roster", rosterId(clean), "upsert", { name: clean, role: role || null, last_seen: new Date().toISOString() }); return; }
  const row = { event_id: eventId, name: clean, last_seen: new Date().toISOString() };
  if (role) row.role = role;
  const { error } = await supabase.from("ref_roster").upsert(
    row,
    { onConflict: "event_id,name" }
  );
  if (error) console.warn("Could not update ref roster", error);
}

export async function deleteRefRoster(eventId, name) {
  if (isVenueMode()) { await venue.write(eventId, "roster", rosterId(name), "delete"); return; }
  const { error } = await supabase.from("ref_roster").delete().eq("event_id", eventId).eq("name", name);
  if (error) throw error;
}

export function joinPresence(eventId, meta, onChange) {
  if (E2E_MOCK) { onChange?.([]); return () => {}; }
  if (isVenueMode()) return venueJoinPresence(eventId, meta, onChange);
  const key = (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) || Math.random().toString(36).slice(2);
  // League: who is online in THIS session (volunteer profiles stay league-wide).
  const sessionId = leagueSessionFor(eventId);
  const ch = supabase.channel(sessionId ? `presence-${eventId}-${sessionId}` : `presence-${eventId}`, { config: { presence: { key } } });
  ch.on("presence", { event: "sync" }, () => onChange(Object.values(ch.presenceState()).flat()));
  ch.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      let userId = null;
      try {
        const { data } = await supabase.auth.getSession();
        userId = data?.session?.user?.id || null;
      } catch {}
      ch.track({ ...meta, user_id: userId });
    }
  });
  return () => supabase.removeChannel(ch);
}

/* ================= configurator completion ================= */
export async function finishConfiguredEvent(eventId, { branding, roleCodes }) {
  if (eventId === "11111111-1111-4111-8111-111111111111") throw new Error("Highlander is protected from generic configurator changes.");
  await upsertEventSetting(eventId, "event_branding", branding || {}, "Configurator");
  await upsertEventSetting(eventId, "role_access_codes", roleCodes || { version: 1, codes: {} }, "Configurator");
  const roleMap = { ref: "ref", judge: "judge", emcee: "emcee", inspection: "inspection" };
  await Promise.all(Object.entries(roleMap).map(([key, serverRole]) => {
    const entry = roleCodes?.codes?.[key];
    return entry?.hash ? setEventAccessCredentialHash(eventId, `${key}_code`, serverRole, entry.hash, entry.enabled !== false) : Promise.resolve();
  }));
}

/* ================= Local Venue Server (Phase 1) =================
   Only used when this device is in Local Venue Server mode (sync/syncConfig.js). Violations,
   field log entries, the volunteer roster and presence go to the venue server; records made in
   Cloud mode stay in Supabase and are still shown (cloud reads use a short timeout and fall back
   to the last successful cloud read). Cloud mode never reaches this code. */
const VENUE_CLOUD_TIMEOUT_MS = 4000;
// Access-code entries (role_code_update carries the new code) always stay in Supabase.
const VENUE_CLOUD_ONLY_FIELD_LOG_KINDS = new Set(["role_code_update", "role_code_request"]);
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new TypeError("Cloud request timed out")), ms))]);

async function cloudRowsOrSnapshot(eventId, kind, query, legacyKind = "") {
  try {
    const { data, error } = await withTimeout(query(), VENUE_CLOUD_TIMEOUT_MS);
    if (error) throw error;
    const rows = data || [];
    venue.saveCloudSnapshot(eventId, kind, rows).catch(() => {});
    return rows;
  } catch {
    const rows = await venue.cloudSnapshot(eventId, kind);
    // A converted League's first session can still show the Tournament-era cloud copy offline.
    if (!rows.length && legacyKind && leagueSessionFor(eventId) && leagueSessionFor(eventId) === leagueLegacySessionFor(eventId)) return venue.cloudSnapshot(eventId, legacyKind);
    return rows;
  }
}

async function venueOwns(kind, recordId, eventId = venue.currentEventId()) {
  if (!eventId || !recordId) return false;
  return !!(await venue.get(eventId, kind, recordId));
}

const venueViolation = (rec) => ({
  ...mapViol({ id: rec.recordId, ...rec.data, photo_paths: [] }),
  _source: "venue",
  _venuePending: !!rec.pending,
  venuePhotoCount: (rec.data?.venue_photos || []).length,
});

// League sessions: venue records carry session_id in their data; a device only shows its session's.
const venueRecordInSession = (eventId, rec, eventScopedKinds = null) => {
  const sessionId = leagueSessionFor(eventId);
  if (!sessionId) return true;
  const recordSession = rec.data?.session_id || null;
  if (recordSession) return recordSession === sessionId;
  if (eventScopedKinds?.has(rec.data?.kind)) return true;
  // Venue records made while a converted League was still a Tournament belong to its first session.
  return sessionId === leagueLegacySessionFor(eventId);
};
async function venueListViolations(eventId) {
  const sessionId = leagueSessionFor(eventId);
  const [cloudRows, local] = await Promise.all([
    cloudRowsOrSnapshot(eventId, sessionId ? `violation@${sessionId}` : "violation", () => inSession(supabase.from("violations").select("*").eq("event_id", eventId), eventId).order("created_at", { ascending: false }), "violation"),
    venue.list(eventId, "violation"),
  ]);
  const byId = new Map(cloudRows.map((r) => [r.id, { ...mapViol(r), _source: "cloud" }]));
  for (const id of local.deletedIds) byId.delete(id);
  for (const rec of local.records) if (venueRecordInSession(eventId, rec)) byId.set(rec.recordId, venueViolation(rec));
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

async function venueSaveViolation(eventId, row, photoDataUrls = [], { edit = false } = {}) {
  const existing = await venue.get(eventId, "violation", row.id);
  const prior = existing?.data || {};
  const photos = [...(edit ? prior.venue_photos || [] : []), ...(photoDataUrls || [])].slice(0, 6);
  const data = {
    team: row.team, type: row.type, code: row.code ?? null, rule_desc: row.rule_desc ?? null, notes: row.notes ?? null,
    match_info: row.match_info ?? null, logged_by: row.logged_by ?? null, logged_by_user: row.logged_by_user ?? null,
    photo_paths: [], created_at: prior.created_at || new Date().toISOString(),
  };
  const sessionId = row.session_id || prior.session_id || leagueSessionFor(eventId);
  if (sessionId) data.session_id = sessionId;
  if (photos.length) data.venue_photos = photos;
  await venue.write(eventId, "violation", row.id, "upsert", data);
  return venueViolation({ recordId: row.id, data, pending: true });
}

async function venueListFieldLog(eventId) {
  const sessionId = leagueSessionFor(eventId);
  const [cloudRows, local] = await Promise.all([
    cloudRowsOrSnapshot(eventId, sessionId ? `field_log@${sessionId}` : "field_log", () => fieldLogInSession(supabase.from("field_log").select("*").eq("event_id", eventId), eventId).order("created_at", { ascending: false }), "field_log"),
    venue.list(eventId, "field_log"),
  ]);
  const byId = new Map(cloudRows.map((r) => [r.id, mapFieldLog(r)]));
  for (const id of local.deletedIds) byId.delete(id);
  for (const rec of local.records) if (venueRecordInSession(eventId, rec, LEAGUE_EVENT_SCOPED_FIELD_LOG_KINDS)) byId.set(rec.recordId, { ...mapFieldLog({ id: rec.recordId, ...rec.data }), _source: "venue" });
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

async function venueAddFieldLog(eventId, row) {
  const { id, event_id: _event, ...rest } = row;
  const data = { ...rest, created_at: new Date().toISOString() };
  for (const key of Object.keys(data)) if (data[key] === null) delete data[key];
  await venue.write(eventId, "field_log", id, "upsert", data);
  return { ...mapFieldLog({ id, ...data }), _source: "venue" };
}

// Deterministic record id for a roster name (names contain spaces and punctuation).
function rosterId(name) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (const ch of String(name || "")) {
    const c = ch.codePointAt(0);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return `roster-${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

async function venueListRoster(eventId) {
  const [cloudRows, local] = await Promise.all([
    cloudRowsOrSnapshot(eventId, "roster", () => supabase.from("ref_roster").select("name,last_seen,role").eq("event_id", eventId).order("name")),
    venue.list(eventId, "roster"),
  ]);
  const byName = new Map(cloudRows.map((r) => [r.name, { name: r.name, lastSeen: r.last_seen ? new Date(r.last_seen).getTime() : 0, role: r.role || "" }]));
  for (const rec of local.records) {
    const d = rec.data || {};
    if (d.name) byName.set(d.name, { name: d.name, lastSeen: d.last_seen ? new Date(d.last_seen).getTime() : 0, role: d.role || "" });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Presence over the venue server: a heartbeat record per device; devices seen in the last 75 s are online.
function venueJoinPresence(eventId, meta, onChange) {
  const presenceKey = `presence-${venueDeviceKey()}`;
  let stopped = false;
  const beat = async () => {
    if (stopped) return;
    let userId = null;
    try { const { data } = await supabase.auth.getSession(); userId = data?.session?.user?.id || null; } catch {}
    const presence = {
      name: meta?.name || null, role: meta?.role || null, user_id: userId, online_at: Number(meta?.online_at) || Date.now(), last_seen: new Date().toISOString(),
    };
    if (leagueSessionFor(eventId)) presence.session_id = leagueSessionFor(eventId);
    await venue.write(eventId, "presence", presenceKey, "upsert", presence).catch(() => {});
  };
  const report = async () => {
    if (stopped) return;
    const { records } = await venue.list(eventId, "presence");
    const cutoff = Date.now() - 75_000;
    onChange?.(records.filter((r) => r.data?.last_seen && Date.parse(r.data.last_seen) >= cutoff && venueRecordInSession(eventId, r)).map((r) => ({ ...r.data })));
  };
  beat().then(report);
  const beatTimer = setInterval(beat, 25_000);
  const off = venue.subscribe(eventId, report);
  const reportTimer = setInterval(report, 15_000);
  return () => { stopped = true; clearInterval(beatTimer); clearInterval(reportTimer); off(); };
}
function venueDeviceKey() {
  try { return localStorage.getItem("refosDeviceId") || "unknown"; } catch { return "unknown"; }
}

// Token stays in the server-side VEX_EVENTS_API_TOKEN secret.
export async function lookupVexEvent(code) {
  await ensureAnonymousSession();
  const { data, error } = await supabase.functions.invoke("vex-event-lookup", { body: { code: String(code || "").trim().toUpperCase() } });
  if (error) {
    let message = "VEX lookup is unavailable. Check the connection and ask the developer to configure it.";
    try { const body = await error.context?.json(); if (typeof body?.error === "string") message = body.error; } catch {}
    throw new Error(message);
  }
  if (!data?.event || !Array.isArray(data.event.teams)) throw new Error("VEX returned incomplete event information.");
  return data.event;
}

export async function searchVexEvents(filters) {
  await ensureAnonymousSession();
  const { data, error } = await supabase.functions.invoke("vex-event-lookup", { body: { ...filters, action: "search" } });
  if (error) {
    let message = "Event search is unavailable. Check the connection or use the event code.";
    try { const body = await error.context?.json(); if (typeof body?.error === "string") message = body.error; } catch {}
    throw new Error(message);
  }
  if (!Array.isArray(data?.events)) throw new Error("VEX returned incomplete search results.");
  return data;
}

export async function getVexStandings(code, division = null, kind = "rankings") {
  await ensureAnonymousSession();
  const { data, error } = await supabase.functions.invoke("vex-event-lookup", { body: { action: "standings", code, division, kind } });
  if (error) {
    let message = "VEX standings lookup is unavailable.";
    try { const body = await error.context?.json(); if (typeof body?.error === "string") message = body.error; } catch {}
    throw new Error(message);
  }
  if (!Array.isArray(data?.divisions)) throw new Error("VEX returned incomplete standings information.");
  return data;
}

export async function lookupVexTeamEvents(number) {
  await ensureAnonymousSession();
  const { data, error } = await supabase.functions.invoke("vex-event-lookup", { body:{action:"team-events",number} });
  if (error) { let message="Team events are unavailable. Check your connection."; try { const body=await error.context?.json(); if(typeof body?.error === "string") message=body.error; } catch {} throw new Error(message); }
  if (!Array.isArray(data?.events)) throw new Error("VEX returned incomplete team events.");
  return data;
}

// Developer-only feedback triage; authorization is enforced by the database RPCs.
export async function listFeedbackManagement(eventId) {
  const { data, error } = await supabase.rpc('list_feedback_management', { p_event: eventId });
  if (error) throw error;
  return data || [];
}
// Keep the legacy helper's null-on-error behavior for other callers.
export async function photoUrlForDisplay(path) {
  if (E2E_MOCK) return null;
  const {data,error} = await supabase.storage.from("robot-photos").createSignedUrl(path,3600);
  if(error) throw error;
  return data?.signedUrl || null;
}
export async function setFeedbackStatus(eventId, feedbackId, status) {
  const { error } = await supabase.rpc('set_feedback_status', { p_event: eventId, p_feedback: feedbackId, p_status: status });
  if (error) throw error;
}

export async function listUniversalFeedback() {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.rpc('list_universal_feedback').range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  return Array.from(new Map(rows.map(row => [row.id, row])).values()).map(row => ({ ...mapFieldLog(row), kind: "feedback", eventId: row.event_id, eventName: row.event_name, sessionName: row.session_name, status: row.status }));
}
export async function setUniversalFeedbackStatus(_eventId, feedbackId, status) {
  const { error } = await supabase.rpc('set_universal_feedback_status', { p_feedback: feedbackId, p_status: status });
  if (error) throw error;
}

export async function getEventRobotPhotoRequirements(eventId) {
 if(E2E_MOCK)return null;
 try {
  const {data,error}=await supabase.rpc('get_event_robot_photo_requirements',{p_event:eventId});
  if(error)throw error;
  if(!data)throw Error('Event access required');
  const row={key:'robot_photo_requirements',value:data,updatedAt:0,updatedBy:''};
  saveReadCache(eventId,'robot_photo_requirements',[row]);return row;
 }catch(error){const cached=loadReadCache(eventId,'robot_photo_requirements')?.[0];if(cached)return cached;throw error;}
}
