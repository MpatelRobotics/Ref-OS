import { supabase } from "./supabaseClient";

export const uid = () =>
  (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) ||
  Date.now().toString(36) + Math.random().toString(36).slice(2);

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
};
export async function listMyEvents() {
  const { data } = await supabase.from("events").select("*").order("created_at", { ascending: false });
  return (data || []).map(mapEvent);
}
export async function getEvent(id) {
  const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  return mapEvent(data);
}
export async function createEvent(d) {
  const { data, error } = await supabase.rpc("create_event", {
    p_name: d.name, p_quals: d.quals, p_practice: d.practice, p_bracket: d.bracket, p_finals: d.finalsBestOf,
  });
  if (error) throw error;
  return mapEvent(Array.isArray(data) ? data[0] : data);
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
export async function listTeams(eventId) {
  const { data } = await supabase.from("teams").select("*").eq("event_id", eventId);
  return (data || []).map(mapTeam);
}
export async function upsertTeam(eventId, number, name) {
  const num = (number || "").trim().toUpperCase();
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
export async function addTeamPhoto(eventId, number, dataUrl) {
  const num = (number || "").trim().toUpperCase();
  const id = (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) || Math.random().toString(36).slice(2);
  const path = `${eventId}/team/${num}/${id}.jpg`;
  const up = await supabase.storage.from("robot-photos").upload(path, dataURLtoBlob(dataUrl), { contentType: "image/jpeg", upsert: true });
  if (up.error) throw up.error;
  const { data: t } = await supabase.from("teams").select("photo_paths").eq("event_id", eventId).eq("number", num).single();
  const paths = [...((t && t.photo_paths) || []), path];
  const { error } = await supabase.from("teams").update({ photo_paths: paths }).eq("event_id", eventId).eq("number", num);
  if (error) throw error;
  return paths;
}
export async function removeTeamPhoto(eventId, number, path) {
  const num = (number || "").trim().toUpperCase();
  await supabase.storage.from("robot-photos").remove([path]);
  const { data: t } = await supabase.from("teams").select("photo_paths").eq("event_id", eventId).eq("number", num).single();
  const paths = ((t && t.photo_paths) || []).filter((p) => p !== path);
  await supabase.from("teams").update({ photo_paths: paths }).eq("event_id", eventId).eq("number", num);
  return paths;
}

/* ================= matches (qualification schedule) ================= */
export async function listMatches(eventId) {
  const { data } = await supabase.from("matches").select("num,red,blue,field,phase,label,winner,red_score,blue_score").eq("event_id", eventId).order("num");
  return (data || []).map((m) => {
    const phase = m.phase || "qual";
    return { id: phase === "qual" ? String(m.num) : `${phase}-${m.num}`, phase, num: m.num, label: m.label || "", winner: m.winner || "", redScore: m.red_score, blueScore: m.blue_score, red: m.red || [], blue: m.blue || [], field: m.field || "" };
  });
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

/* ================= field log (timeouts / faults / replays) ================= */
const mapFieldLog = (r) => ({ id: r.id, kind: r.kind, field: r.field || "", matchRef: r.match_ref || "", matchId: r.match_id || "", alliance: r.alliance || "", team: r.team || "", teams: r.teams || [], note: r.note || "", by: r.logged_by || "", createdAt: new Date(r.created_at).getTime() });
export async function listFieldLog(eventId) {
  const { data } = await supabase.from("field_log").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
  return (data || []).map(mapFieldLog);
}
export async function addFieldLog(eventId, e) {
  const id = (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) || Math.random().toString(36).slice(2);
  const row = { id, event_id: eventId, kind: e.kind, field: e.field || null, match_ref: e.matchRef || null, match_id: e.matchId || null, alliance: e.alliance || null, team: e.team || null, teams: (e.teams && e.teams.length) ? e.teams : null, note: (e.note || "").trim(), logged_by: e.by || "" };
  const { data, error } = await supabase.from("field_log").upsert(row, { onConflict: "id" }).select().single();
  if (error) throw error;
  return mapFieldLog(data);
}
export async function deleteFieldLog(id) {
  const { error } = await supabase.from("field_log").delete().eq("id", id);
  if (error) throw error;
}

/* ================= elimination alliances ================= */
const mapAlliance = (r) => ({ seed: r.seed, teams: r.teams || [] });
export async function listAlliances(eventId) {
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
  const { data } = await supabase.from("rules").select("code,description,category,ord").eq("event_id", eventId).order("ord");
  return (data || []).map((r) => ({ code: r.code, desc: r.description || "", category: r.category || "" }));
}

/* ================= award nominations (Judging) ================= */
const mapNom = (r) => ({ id: r.id, award: r.award, team: r.team, match: r.match_info || null, reason: r.reason || "", criteria: r.criteria || [], whereWhen: r.where_when || "", by: r.nominated_by || "", createdAt: new Date(r.created_at).getTime() });
export async function listNominations(eventId) {
  const { data } = await supabase.from("nominations").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
  return (data || []).map(mapNom);
}
export async function addNomination(eventId, n) {
  const id = (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) || Math.random().toString(36).slice(2);
  const cleanMatch = n.match && n.match.phase && n.match.phase !== "none" ? { phase: n.match.phase, num: (n.match.num || "").trim() } : null;
  const row = { id, event_id: eventId, award: n.award, team: (n.team || "").trim().toUpperCase(), match_info: cleanMatch, reason: (n.reason || "").trim(), criteria: (n.criteria && n.criteria.length) ? n.criteria : null, where_when: (n.whereWhen || "").trim() || null, nominated_by: n.by || "" };
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
const mapViol = (r) => ({
  id: r.id, team: r.team, type: r.type, code: r.code, desc: r.rule_desc || "",
  notes: r.notes || "", match: r.match_info || null, by: r.logged_by || "",
  photoKeys: r.photo_paths || [], createdAt: new Date(r.created_at).getTime(),
});
export async function listViolations(eventId) {
  const { data } = await supabase.from("violations").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
  return (data || []).map(mapViol);
}
// Build the DB row (with a client-generated UUID) without touching the network.
// The UUID lets us show the violation immediately and retry the write idempotently.
export function buildViolationRow(eventId, v) {
  return {
    id: uid(), event_id: eventId, team: v.team, type: v.type, code: v.code,
    rule_desc: v.desc, notes: v.notes, match_info: v.match, logged_by: v.by,
  };
}
// Upload photos then upsert the row. Safe to call more than once for the same
// row (same id) — a retry after a lost ack just overwrites identically.
export async function addViolationRow(eventId, row, photoDataUrls = []) {
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
  const removed = allOldKeys.filter((k) => !keepKeys.includes(k));
  if (removed.length) await supabase.storage.from("robot-photos").remove(removed);
  const paths = [...keepKeys];
  for (let i = 0; i < newPhotoDataUrls.length; i++) {
    const path = `${eventId}/${row.id}/e${Date.now()}-${i}.jpg`;
    const { error } = await supabase.storage.from("robot-photos").upload(path, dataURLtoBlob(newPhotoDataUrls[i]), { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
    paths.push(path);
  }
  const { data, error } = await supabase.from("violations").upsert({ ...row, photo_paths: paths }, { onConflict: "id" }).select().single();
  if (error) throw error;
  return mapViol(data);
}
export async function deleteViolation(v) {
  if (v.photoKeys?.length) await supabase.storage.from("robot-photos").remove(v.photoKeys);
  await supabase.from("violations").delete().eq("id", v.id);
}
export async function clearViolations(eventId) {
  const { data: vs } = await supabase.from("violations").select("photo_paths").eq("event_id", eventId);
  const paths = (vs || []).flatMap((v) => v.photo_paths || []);
  if (paths.length) await supabase.storage.from("robot-photos").remove(paths);
  await supabase.from("violations").delete().eq("event_id", eventId);
}
export async function clearTeams(eventId) {
  await supabase.from("teams").delete().eq("event_id", eventId);
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
  const { data } = supabase.storage.from("robot-photos").getPublicUrl(path);
  return data?.publicUrl || null;
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
  const ch = supabase
    .channel(`event-${eventId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "violations", filter: `event_id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `event_id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "nominations", filter: `event_id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "shortlist", filter: `event_id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "watch_notes", filter: `event_id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `event_id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "field_log", filter: `event_id=eq.${eventId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "alliances", filter: `event_id=eq.${eventId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(ch);
}

/* live presence — who's currently on the log. onChange gets an array of {name, ...} */
export async function listRefRoster(eventId) {
  const { data, error } = await supabase.from("ref_roster").select("name,last_seen,role").eq("event_id", eventId).order("name");
  if (error) { console.warn("Could not load ref roster", error); return []; }
  return (data || []).map((r) => ({ name: r.name, lastSeen: r.last_seen ? new Date(r.last_seen).getTime() : 0, role: r.role || "" }));
}

export async function touchRefRoster(eventId, name, role) {
  const clean = (name || "Ref").trim();
  if (!clean) return;
  const row = { event_id: eventId, name: clean, last_seen: new Date().toISOString() };
  if (role) row.role = role;
  const { error } = await supabase.from("ref_roster").upsert(
    row,
    { onConflict: "event_id,name" }
  );
  if (error) console.warn("Could not update ref roster", error);
}

export async function deleteRefRoster(eventId, name) {
  const { error } = await supabase.from("ref_roster").delete().eq("event_id", eventId).eq("name", name);
  if (error) throw error;
}

export function joinPresence(eventId, meta, onChange) {
  const key = (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) || Math.random().toString(36).slice(2);
  const ch = supabase.channel(`presence-${eventId}`, { config: { presence: { key } } });
  ch.on("presence", { event: "sync" }, () => onChange(Object.values(ch.presenceState()).flat()));
  ch.subscribe((status) => { if (status === "SUBSCRIBED") ch.track(meta); });
  return () => supabase.removeChannel(ch);
}
