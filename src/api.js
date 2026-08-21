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
const mapTeam = (r) => ({ number: r.number, name: r.name || "", createdAt: new Date(r.created_at).getTime() });
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
export async function deleteTeam(eventId, number) {
  const { data: vs } = await supabase.from("violations").select("photo_paths").eq("event_id", eventId).eq("team", number);
  const paths = (vs || []).flatMap((v) => v.photo_paths || []);
  if (paths.length) await supabase.storage.from("robot-photos").remove(paths);
  await supabase.from("violations").delete().eq("event_id", eventId).eq("team", number);
  await supabase.from("teams").delete().eq("event_id", eventId).eq("number", number);
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
export async function deleteViolation(v) {
  if (v.photoKeys?.length) await supabase.storage.from("robot-photos").remove(v.photoKeys);
  await supabase.from("violations").delete().eq("id", v.id);
}
export async function clearEvent(eventId) {
  const { data: vs } = await supabase.from("violations").select("photo_paths").eq("event_id", eventId);
  const paths = (vs || []).flatMap((v) => v.photo_paths || []);
  if (paths.length) await supabase.storage.from("robot-photos").remove(paths);
  await supabase.from("violations").delete().eq("event_id", eventId);
  await supabase.from("teams").delete().eq("event_id", eventId);
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
    .subscribe();
  return () => supabase.removeChannel(ch);
}
