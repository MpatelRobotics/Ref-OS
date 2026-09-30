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
    const lifecycle = await listEventLifecycle();
    return choices.map((choice) => ({
      ...choice,
      archivedAt: lifecycle?.get(choice.id)?.archivedAt || null,
      createdAt: lifecycle?.get(choice.id)?.createdAt || null,
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
export async function createVexEvent(name, adminCredential) {
  await ensureAnonymousSession();
  const cleanName = String(name || "").trim();
  const cleanCredential = String(adminCredential || "").trim().toUpperCase();
  const { data, error } = await supabase.rpc("create_refos_vex_event", {
    p_name: cleanName,
    p_admin_credential: cleanCredential,
  });
  if (error) throw error;
  return mapEvent(Array.isArray(data) ? data[0] : data);
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
  try {
    const { data, error } = await supabase.from("teams").select("*").eq("event_id", eventId);
    if (error) throw error;
    const teams = (data || []).map(mapTeam);
    saveReadCache(eventId, "teams", teams);
    return teams;
  } catch (error) {
    const cached = loadReadCache(eventId, "teams");
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
export function robotPhotoPath(eventId, number, angle, id, mime = "image/jpeg") {
  const num = String(number || "").trim().toUpperCase();
  const ext = /webp/i.test(String(mime)) ? "webp" : "jpg";
  return `${eventId}/team/${num}/${robotPhotoAngleKey(angle)}-${id}.${ext}`;
}
const dataUrlMimeType = (dataUrl) => (String(dataUrl).match(/^data:([^;,]+)/) || [])[1] || "image/jpeg";
const pathAngle = (path) => (String(path || "").match(/\/(front|back|side|tag|lexan|other)-[^/]+\.(?:jpe?g|webp)$/i) || [])[1]?.toLowerCase() || "";

export async function addTeamPhoto(eventId, number, dataUrl, angle = "other", uploadId = "", generation = "0") {
  const currentGeneration = await getRobotPhotoGeneration(eventId);
  if (currentGeneration !== generation) return null;
  const num = (number || "").trim().toUpperCase();
  const safeAngle = robotPhotoAngleKey(angle);
  const id = uploadId || ((self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) || Math.random().toString(36).slice(2));
  const mime = dataUrlMimeType(dataUrl);
  const path = robotPhotoPath(eventId, num, safeAngle, id, mime);
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
    const older = current.filter((existing) => existing !== path && pathAngle(existing) === safeAngle);
    for (const oldPath of older) {
      try { current = await removeTeamPhoto(eventId, num, oldPath); }
      catch (cleanupError) { console.warn("Older robot photo could not be removed yet", cleanupError); }
    }
  }
  return current;
}
export async function removeTeamPhoto(eventId, number, path) {
  const num = (number || "").trim().toUpperCase();
  const { data: paths, error } = await supabase.rpc("remove_team_photo_path", { p_event: eventId, p_team: num, p_path: path });
  if (error) throw error;
  const { error: storageError } = await supabase.storage.from("robot-photos").remove([path]);
  if (storageError) throw storageError;
  await deleteCachedPhotos([path]);
  return paths || [];
}
// Removes cloud photo objects for permanently deleted events. Runs server-side in the
// purge-deleted-event-photos Edge Function; no service-role key exists in the browser.
export async function purgeDeletedEventPhotos() {
  if (E2E_MOCK) return { purged: [] };
  const { data, error } = await supabase.functions.invoke("purge-deleted-event-photos", { body: {} });
  if (error) throw error;
  return data;
}
export async function resetTeamPhotos(eventId) {
  if (E2E_MOCK) {
    e2eState.teams = e2eState.teams.map((team) => ({ ...team, photoKeys: [] }));
    e2eRobotGeneration = uid();
    return { version: e2eRobotGeneration, paths: [] };
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
  const { error } = await supabase.rpc("finish_robot_photo_cleanup", { p_event: eventId, p_version: reset.version });
  if (error) throw error;
}

/* ================= matches (qualification schedule) ================= */
export async function listMatches(eventId) {
  if (E2E_MOCK) return [];
  try {
    const { data, error } = await supabase.from("matches").select("num,red,blue,field,phase,label,winner,red_score,blue_score").eq("event_id", eventId).order("num");
    if (error) throw error;
    const matches = (data || []).map((m) => {
      const phase = m.phase || "qual";
      return { id: phase === "qual" ? String(m.num) : `${phase}-${m.num}`, phase, num: m.num, label: m.label || "", winner: m.winner || "", redScore: m.red_score, blueScore: m.blue_score, red: m.red || [], blue: m.blue || [], field: m.field || "" };
    });
    saveReadCache(eventId, "matches", matches);
    return matches;
  } catch (error) {
    const cached = loadReadCache(eventId, "matches");
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
  const { error } = await supabase.from("matches").upsert(row, { onConflict: "event_id,phase,num" });
  if (error) throw error;
}
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
    .eq("num", Number(num));
  if (error) throw error;
}

export async function setMatchWinner(eventId, phase, num, winner) {
  const { error } = await supabase.from("matches").update({ winner: winner || null }).eq("event_id", eventId).eq("phase", phase).eq("num", Number(num));
  if (error) throw error;
}
export async function deleteMatch(eventId, phase, num) {
  const { error } = await supabase.from("matches").delete().eq("event_id", eventId).eq("phase", phase).eq("num", Number(num));
  if (error) throw error;
}

/* ================= event settings (shared configuration) ================= */
const mapEventSetting = (r) => ({ key: r.key, value: r.value, updatedBy: r.updated_by || "", updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : 0 });
export async function listEventSettings(eventId) {
  if (E2E_MOCK) return {};
  const { data, error } = await supabase.from("event_settings").select("*").eq("event_id", eventId);
  if (error) throw error;
  return Object.fromEntries((data || []).map((r) => [r.key, mapEventSetting(r)]));
}
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
export async function getEventFieldNames(eventId) {
  if (E2E_MOCK) return null;
  const { data, error } = await supabase.rpc("get_event_field_names", { p_event: eventId });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { key: "field_names", value: row.field_names || {}, updatedBy: "", updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0 };
}
export async function getEventSetting(eventId, key) {
  const { data, error } = await supabase.from("event_settings").select("*").eq("event_id", eventId).eq("key", key).maybeSingle();
  if (error) throw error;
  return data ? mapEventSetting(data) : null;
}
export async function upsertEventSetting(eventId, key, value, by = "") {
  if (E2E_MOCK) return { key, value, updatedBy: by || "", updatedAt: Date.now() };
  const row = { event_id: eventId, key, value, updated_by: by || "", updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("event_settings").upsert(row, { onConflict: "event_id,key" }).select().single();
  if (error) throw error;
  return mapEventSetting(data);
}
export async function deleteEventSetting(eventId, key) {
  if (E2E_MOCK) return;
  const { error } = await supabase.from("event_settings").delete().eq("event_id", eventId).eq("key", key);
  if (error) throw error;
}

/* ================= field log (timeouts / faults / replays) ================= */
const mapFieldLog = (r) => ({ id: r.id, kind: r.kind, field: r.field || "", matchRef: r.match_ref || "", matchId: r.match_id || "", alliance: r.alliance || "", team: r.team || "", teams: r.teams || [], note: r.note || "", by: r.logged_by || "", createdAt: new Date(r.created_at).getTime() });
export async function listFieldLog(eventId) {
  if (E2E_MOCK) return [];
  if (isVenueMode()) return venueListFieldLog(eventId);
  const { data } = await supabase.from("field_log").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
  return (data || []).map(mapFieldLog);
}
export async function addFieldLog(eventId, e) {
  const id = (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) || Math.random().toString(36).slice(2);
  const row = { id, event_id: eventId, kind: e.kind, field: e.field || null, match_ref: e.matchRef || null, match_id: e.matchId || null, alliance: e.alliance || null, team: e.team || null, teams: (e.teams && e.teams.length) ? e.teams : null, note: (e.note || "").trim(), logged_by: e.by || "" };
  if (isVenueMode() && !VENUE_CLOUD_ONLY_FIELD_LOG_KINDS.has(row.kind)) return venueAddFieldLog(eventId, row);
  const { data, error } = await supabase.from("field_log").upsert(row, { onConflict: "id" }).select().single();
  if (error) throw error;
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
  const { data, error } = await supabase
    .from("field_reset_checks")
    .select("*")
    .eq("event_id", eventId)
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
  const { data, error } = await supabase
    .from("field_reset_checks")
    .upsert(row, { onConflict: "event_id,match_id,quadrant" })
    .select()
    .single();
  if (error) throw error;
  return mapFieldResetCheck(data);
}

export async function clearFieldResetMatch(eventId, matchId) {
  if (E2E_MOCK) return;
  const { error } = await supabase
    .from("field_reset_checks")
    .delete()
    .eq("event_id", eventId)
    .eq("match_id", String(matchId));
  if (error) throw error;
}

export async function clearFieldResetChecks(eventId) {
  if (E2E_MOCK) return;
  const { error } = await supabase.from("field_reset_checks").delete().eq("event_id", eventId);
  if (error) throw error;
}

/* ================= elimination alliances ================= */
const mapAlliance = (r) => ({ seed: r.seed, teams: r.teams || [] });
export async function listAlliances(eventId) {
  if (E2E_MOCK) return [];
  const { data } = await supabase.from("alliances").select("seed,teams").eq("event_id", eventId).order("seed");
  return (data || []).map(mapAlliance);
}
export async function upsertAlliance(eventId, seed, teams) {
  const row = { event_id: eventId, seed: Number(seed), teams: teams || [], updated_at: new Date().toISOString() };
  const { error } = await supabase.from("alliances").upsert(row, { onConflict: "event_id,seed" });
  if (error) throw error;
}
export async function clearAlliances(eventId) {
  const { error } = await supabase.from("alliances").delete().eq("event_id", eventId);
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
  const { data } = await supabase.from("nominations").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
  return (data || []).map(mapNom);
}
export async function addNomination(eventId, n) {
  const id = (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) || Math.random().toString(36).slice(2);
  const cleanMatch = n.match && n.match.phase && n.match.phase !== "none" ? { phase: n.match.phase, num: (n.match.num || "").trim() } : null;
  const row = { id, event_id: eventId, award: n.award, team: (n.team || "").trim().toUpperCase(), match_info: cleanMatch, reason: (n.reason || "").trim(), criteria: (n.criteria && n.criteria.length) ? n.criteria : null, where_when: (n.whereWhen || "").trim() || null, nominated_by: encodeAttribution(n.by, n.byFullName), nominated_role: n.byRole || null };
  const { data, error } = await supabase.from("nominations").upsert(row, { onConflict: "id" }).select().single();
  if (error) throw error;
  return mapNom(data);
}
export async function deleteNomination(id) {
  await supabase.from("nominations").delete().eq("id", id);
}
export async function clearJudging(eventId) {
  const { error: nomError } = await supabase.from("nominations").delete().eq("event_id", eventId);
  if (nomError) throw nomError;
  const { error: shortlistError } = await supabase.from("shortlist").delete().eq("event_id", eventId);
  if (shortlistError) throw shortlistError;
}


/* ---- award shortlist / finalists ---- */
export async function listShortlist(eventId) {
  if (E2E_MOCK) return [];
  const { data } = await supabase.from("shortlist").select("award,team").eq("event_id", eventId);
  return (data || []).map((r) => ({ award: r.award, team: r.team }));
}
export async function setShortlist(eventId, award, team, on) {
  if (on) {
    const { error } = await supabase.from("shortlist").upsert({ event_id: eventId, award, team }, { onConflict: "event_id,award,team" });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("shortlist").delete().eq("event_id", eventId).eq("award", award).eq("team", team);
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
  };
};
export async function listViolations(eventId) {
  if (E2E_MOCK) return e2eState.violations.map((v) => ({ ...v }));
  if (isVenueMode()) return venueListViolations(eventId);
  const { data } = await supabase.from("violations").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
  return (data || []).map(mapViol);
}
// Build the DB row (with a client-generated UUID) without touching the network.
// The UUID lets us show the violation immediately and retry the write idempotently.
export function buildViolationRow(eventId, v) {
  return {
    id: uid(), event_id: eventId, team: v.team, type: v.type, code: v.code,
    rule_desc: v.desc, notes: v.notes, match_info: v.match, logged_by: encodeAttribution(v.by, v.byFullName), logged_by_user: v.byUserId,
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
  const { data: vs } = await supabase.from("violations").select("photo_paths").eq("event_id", eventId);
  const paths = (vs || []).flatMap((v) => v.photo_paths || []);
  if (paths.length) await supabase.storage.from("robot-photos").remove(paths);
  await supabase.from("violations").delete().eq("event_id", eventId);
}
export async function clearTeams(eventId) {
  if (E2E_MOCK) { e2eState.teams = []; return; }
  const { error } = await supabase.from("teams").delete().eq("event_id", eventId);
  if (error) throw error;
}
export async function clearMatches(eventId) {
  await supabase.from("matches").delete().eq("event_id", eventId);
}
export async function clearRankings(eventId) {
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
    .on("postgres_changes", { event: "*", schema: "public", table: "alliances", filter: `event_id=eq.${eventId}` }, onChange)
    .subscribe();
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
  const ch = supabase.channel(`presence-${eventId}`, { config: { presence: { key } } });
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

async function cloudRowsOrSnapshot(eventId, kind, query) {
  try {
    const { data, error } = await withTimeout(query(), VENUE_CLOUD_TIMEOUT_MS);
    if (error) throw error;
    const rows = data || [];
    venue.saveCloudSnapshot(eventId, kind, rows).catch(() => {});
    return rows;
  } catch {
    return venue.cloudSnapshot(eventId, kind);
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

async function venueListViolations(eventId) {
  const [cloudRows, local] = await Promise.all([
    cloudRowsOrSnapshot(eventId, "violation", () => supabase.from("violations").select("*").eq("event_id", eventId).order("created_at", { ascending: false })),
    venue.list(eventId, "violation"),
  ]);
  const byId = new Map(cloudRows.map((r) => [r.id, { ...mapViol(r), _source: "cloud" }]));
  for (const id of local.deletedIds) byId.delete(id);
  for (const rec of local.records) byId.set(rec.recordId, venueViolation(rec));
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
  if (photos.length) data.venue_photos = photos;
  await venue.write(eventId, "violation", row.id, "upsert", data);
  return venueViolation({ recordId: row.id, data, pending: true });
}

async function venueListFieldLog(eventId) {
  const [cloudRows, local] = await Promise.all([
    cloudRowsOrSnapshot(eventId, "field_log", () => supabase.from("field_log").select("*").eq("event_id", eventId).order("created_at", { ascending: false })),
    venue.list(eventId, "field_log"),
  ]);
  const byId = new Map(cloudRows.map((r) => [r.id, mapFieldLog(r)]));
  for (const id of local.deletedIds) byId.delete(id);
  for (const rec of local.records) byId.set(rec.recordId, { ...mapFieldLog({ id: rec.recordId, ...rec.data }), _source: "venue" });
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
    await venue.write(eventId, "presence", presenceKey, "upsert", {
      name: meta?.name || null, role: meta?.role || null, user_id: userId, online_at: Number(meta?.online_at) || Date.now(), last_seen: new Date().toISOString(),
    }).catch(() => {});
  };
  const report = async () => {
    if (stopped) return;
    const { records } = await venue.list(eventId, "presence");
    const cutoff = Date.now() - 75_000;
    onChange?.(records.filter((r) => r.data?.last_seen && Date.parse(r.data.last_seen) >= cutoff).map((r) => ({ ...r.data })));
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
