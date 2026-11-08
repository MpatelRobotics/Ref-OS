// TM uses instance for elimination pairings and match for games within a pairing.
const phases = {
  QUAL: 'qual', PRACTICE: 'practice', R16: 'r16', RO16: 'r16',
  QF: 'qf', QTR: 'qf', QUARTERFINAL: 'qf', QUARTERFINALS: 'qf',
  SF: 'sf', SEMI: 'sf', SEMIFINAL: 'sf', SEMIFINALS: 'sf',
  F: 'final', FINAL: 'final', FINALS: 'final',
};
export function tmMatchIdentity(tuple) {
  const phase = phases[tuple?.round];
  if (!phase || !Number.isSafeInteger(tuple.match) || tuple.match < 1) return null;
  const pairing = ['r16', 'qf', 'sf'].includes(phase);
  if (pairing && (!Number.isSafeInteger(tuple.instance) || tuple.instance < 1)) return null;
  // Keep game one compatible with imported brackets; reserve higher numbers for replays.
  if (pairing && (tuple.instance >= 1000 || tuple.match > 1000)) return null;
  if (!pairing && (tuple.match >= 1000000 || tuple.instance != null && (!Number.isSafeInteger(tuple.instance) || tuple.instance < 0 || tuple.instance > 1000))) return null;
  const attempt = Math.max(1, tuple.instance ?? 1);
  return { phase, num: pairing ? (tuple.match - 1) * 1000 + tuple.instance : (attempt - 1) * 1000000 + tuple.match };
}
export function tmPairingNumber(phase, num) {
  return ['r16', 'qf', 'sf'].includes(phase) ? Number(num) % 1000 : Number(num) % 1000000;
}
export function tmGameNumber(phase, num) {
  return ['r16', 'qf', 'sf'].includes(phase) ? Math.floor(Number(num) / 1000) + 1 : Math.floor(Number(num) / 1000000) + 1;
}
export function tmMatchOrder(a, b) {
  return tmPairingNumber(a.phase, a.num) - tmPairingNumber(b.phase, b.num) || tmGameNumber(a.phase, a.num) - tmGameNumber(b.phase, b.num);
}

// Retain every attempt for history, but count only the latest published attempt
// of a qualification or finals game in records/championship tallies.
export function latestTmAttempts(matches) {
 const rows=new Map();
 for(const m of Object.values(matches||{})){
  const key=`${m.phase}:${tmPairingNumber(m.phase,m.num)}`;
  if(!rows.has(key)||tmGameNumber(m.phase,m.num)>tmGameNumber(m.phase,rows.get(key).num))rows.set(key,m);
 }
 return [...rows.values()];
}
