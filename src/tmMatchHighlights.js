import { tmMatchIdentity } from './tmMatchIdentity.js';
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
    const following = rows.filter(row => row.phase === phase && row.num > current[0].num && (row.redScore == null || row.blueScore == null)).sort((a, b) => a.num - b.num);
    if (following.length && following.filter(row => row.num === following[0].num).length === 1 && result[following[0].id] !== 'current') result[following[0].id] = 'upcoming';
  }
  return result;
}
