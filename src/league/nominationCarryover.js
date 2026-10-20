// Keep original record IDs and session attribution; never copy carried records.
export function recordsThroughSession(nominations, sessions, sessionId, legacySessionId = null) {
  if (!sessionId) return nominations;
  const ordered = [...sessions].sort((a, b) => (a.order - b.order)
    || String(a.date || "").localeCompare(String(b.date || ""))
    || String(a.name || "").localeCompare(String(b.name || "")));
  const index = ordered.findIndex(s => s.id === sessionId);
  const visible = new Set(index < 0 ? [sessionId] : ordered.slice(0, index + 1).map(s => s.id));
  return nominations.filter(n => visible.has(n.sessionId || legacySessionId));
}

export const nominationsThroughSession = recordsThroughSession;
