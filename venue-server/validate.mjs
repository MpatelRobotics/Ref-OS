// Input validation for the Ref OS Venue Server. Only these record kinds and fields are accepted;
// anything else is refused. Clients never send SQL or table names.

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY_RE = /^[0-9a-f]{64}$/;
const ID_RE = /^[A-Za-z0-9._:@-]{1,128}$/;

export const isEventId = (value) => typeof value === "string" && UUID_RE.test(value);
export const isVenueKey = (value) => typeof value === "string" && KEY_RE.test(value);
export const isDeviceId = (value) => typeof value === "string" && ID_RE.test(value);

const str = (value, max) => (value == null ? null : typeof value === "string" && value.length <= max ? value : undefined);
const isoDate = (value) => (value == null ? null : typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value)) ? value : undefined);
const strArray = (value, maxItems, maxLen) =>
  value == null ? null : Array.isArray(value) && value.length <= maxItems && value.every((v) => typeof v === "string" && v.length <= maxLen) ? value : undefined;
// League session a record belongs to (League events only); absent for tournaments.
const sessionId = (value) => (value == null ? null : isEventId(value) ? value.toLowerCase() : undefined);
const plainObject = (value, maxBytes) =>
  value == null ? null : value && typeof value === "object" && !Array.isArray(value) && JSON.stringify(value).length <= maxBytes ? value : undefined;

// Violation photos taken in venue mode travel inline (JPEG data URLs) so they are not lost.
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const photos = (value) =>
  value == null ? null : Array.isArray(value) && value.length <= 6 && value.every((v) => typeof v === "string" && v.length <= 1_500_000 && PHOTO_RE.test(v)) ? value : undefined;

// Field sets mirror the Supabase row shapes Ref OS already uses, so venue data can later be
// reconciled into the same tables.
const SCHEMAS = {
  violation: {
    maxBytes: 7_000_000,
    fields: {
      team: (v) => str(v, 16), type: (v) => str(v, 24), code: (v) => str(v, 120), rule_desc: (v) => str(v, 2000),
      notes: (v) => str(v, 4000), match_info: (v) => plainObject(v, 500), logged_by: (v) => str(v, 400),
      logged_by_user: (v) => str(v, 64), photo_paths: (v) => strArray(v, 12, 300), created_at: isoDate, venue_photos: photos,
      session_id: sessionId,
    },
    required: ["team", "type", "created_at"],
  },
  field_log: {
    maxBytes: 16_000,
    fields: {
      kind: (v) => str(v, 40), field: (v) => str(v, 80), match_ref: (v) => str(v, 80), match_id: (v) => str(v, 80),
      alliance: (v) => str(v, 16), team: (v) => str(v, 16), teams: (v) => strArray(v, 12, 16), note: (v) => str(v, 8000),
      logged_by: (v) => str(v, 200), created_at: isoDate, session_id: sessionId,
    },
    required: ["kind", "created_at"],
  },
  roster: {
    maxBytes: 2_000,
    fields: { name: (v) => str(v, 80), role: (v) => str(v, 40), last_seen: isoDate },
    required: ["name"],
  },
  presence: {
    maxBytes: 4_000,
    fields: {
      name: (v) => str(v, 80), role: (v) => str(v, 40), user_id: (v) => str(v, 64), online_at: (v) => (v == null || Number.isFinite(v) ? v ?? null : undefined),
      last_seen: isoDate, session_id: sessionId,
    },
    required: ["last_seen"],
  },
};
export const KINDS = Object.keys(SCHEMAS);

// Field log kinds that concern event access codes stay in Supabase only; the venue server never
// stores them (a role_code_update entry carries the new code).
export const CLOUD_ONLY_FIELD_LOG_KINDS = new Set(["role_code_update", "role_code_request"]);

function cleanData(kind, data) {
  const schema = SCHEMAS[kind];
  if (!data || typeof data !== "object" || Array.isArray(data)) return { error: "data must be an object" };
  if (JSON.stringify(data).length > schema.maxBytes) return { error: "data too large" };
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    const check = schema.fields[key];
    if (!check) return { error: `field not allowed: ${key.slice(0, 40)}` };
    const cleaned = check(value);
    if (cleaned === undefined) return { error: `invalid field: ${key}` };
    if (cleaned !== null) out[key] = cleaned;
  }
  for (const key of schema.required) if (out[key] == null) return { error: `missing field: ${key}` };
  if (kind === "field_log" && CLOUD_ONLY_FIELD_LOG_KINDS.has(out.kind)) return { error: "access-code entries are not stored on the venue server" };
  return { data: out };
}

export function validateChange(change) {
  if (!change || typeof change !== "object") return { error: "change must be an object" };
  const { changeId, kind, recordId, op, data, baseVersion, clientTs } = change;
  if (!isDeviceId(changeId)) return { error: "invalid changeId" };
  if (!SCHEMAS[kind]) return { error: "unsupported kind" };
  if (!isDeviceId(recordId)) return { error: "invalid recordId" };
  if (op !== "upsert" && op !== "delete") return { error: "invalid op" };
  if (baseVersion != null && !Number.isInteger(baseVersion)) return { error: "invalid baseVersion" };
  if (clientTs != null && !Number.isFinite(clientTs)) return { error: "invalid clientTs" };
  const base = { changeId, kind, recordId, op, baseVersion: baseVersion ?? null, clientTs: clientTs ?? null };
  if (op === "delete") return { change: base };
  const cleaned = cleanData(kind, data);
  if (cleaned.error) return { error: cleaned.error };
  return { change: { ...base, data: cleaned.data } };
}
