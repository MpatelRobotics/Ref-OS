const positive = n => Number.isSafeInteger(n) && n > 0;
const nonnegative = n => Number.isSafeInteger(n) && n >= 0;
export function applyFieldEvent(set, message, now = Date.now()) {
  if (!message || typeof message !== 'object') return false;
  if (message.type === 'audienceDisplayChanged') {
    if (typeof message.display !== 'string' || message.display.length > 100) return false;
    set.display = message.display; return true;
  }
  const field = set.fields.find(row => row.id === message.fieldID);
  if (!field) return false;
  if (message.type === 'fieldMatchAssigned') {
    const m = message.match;
    if (!m || !positive(m.division) || !nonnegative(m.session) || !positive(m.match) || !positive(m.instance) || typeof m.round !== 'string' || m.round.length > 30) return false;
    field.match = { division: m.division, session: m.session, round: m.round, match: m.match, instance: m.instance };
    field.status = 'queued';
  } else if (message.type === 'fieldActivated') {
    for (const row of set.fields) row.active = row === field;
  } else if (message.type === 'matchStarted') field.status = 'playing';
  else if (message.type === 'matchStopped') field.status = 'stopped';
  else return false;
  field.observedAt = now; return true;
}

