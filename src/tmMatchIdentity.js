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
  // The existing bracket represents one game per non-final pairing. Never collapse a series.
  if (pairing && tuple.match !== 1) return null;
  return { phase, num: pairing ? tuple.instance : tuple.match };
}
