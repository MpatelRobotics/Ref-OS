import { tmMatchIdentity, tmMatchOrder } from './tmMatchIdentity.js';
export function tmMatchHighlights(matches, activity, now = Date.now()) {
  const result = {};
  if (!activity?.updatedAt || now - activity.updatedAt > 90000) return result;
  const rows = Object.values(matches);
  const fields = (activity.fieldSets || []).filter(set => set.connected).flatMap(set => set.fields || []);
  for (const field of fields) {
    if (field.status !== 'playing' || !field.match) continue;
    const identity = tmMatchIdentity(field.match);
    if (!identity) continue;
    const { phase, num } = identity;
    const current = rows.filter(row => row.phase === phase && row.num === num);
    if (current.length !== 1) continue;
    result[current[0].id] = 'current';
    const rounds = ['r16', 'qf', 'sf', 'final'];
    const order = rounds.indexOf(phase);
    const following = rows.filter(row => (row.phase === phase && tmMatchOrder(row, current[0]) > 0 || order >= 0 && rounds.indexOf(row.phase) > order) && (row.redScore == null || row.blueScore == null)).sort((a, b) => (rounds.indexOf(a.phase) - rounds.indexOf(b.phase)) || tmMatchOrder(a, b));
    if (following.length && following.filter(row => row.phase === following[0].phase && row.num === following[0].num).length === 1 && result[following[0].id] !== 'current') result[following[0].id] = 'upcoming';
  }
  return result;
}
