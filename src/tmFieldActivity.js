export function scopeTmFieldActivity(data, division, session) {
  if (!Array.isArray(data?.fieldSets)) throw Error('TM returned invalid live field activity.');
  return data.fieldSets.map(set => ({
    id: set.id, name: set.name, connected: set.connected === true,
    fields: (set.fields || []).filter(f => !f.match || f.match.division === division && f.match.session === session).map(f => ({
      id: f.id, name: f.name, active: f.active === true, status: ['queued','playing','stopped'].includes(f.status) ? f.status : 'unknown',
      match: f.match || null, observedAt: f.observedAt || null,
    })),
  }));
}
