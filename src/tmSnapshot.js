import { tmMatchIdentity } from './tmMatchIdentity.js';
const number = value => typeof value === 'string' && /^[0-9]+[A-Z]*$/i.test(value.trim()) ? value.trim().toUpperCase() : null;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => integer(value) && value > 0;
function list(value, label) { if (!Array.isArray(value)) throw Error(`TM returned an invalid ${label} list.`); return value; }
export function normalizeTmSnapshot(data, session) {
  if (!data.event || typeof data.event.name !== 'string' || data.event.code != null && typeof data.event.code !== 'string') throw Error('TM returned invalid event information.');
  const warnings = [];
  const teams = list(data.teams, 'teams').map(t => ({ number: number(t.number), name: typeof t.name === 'string' ? t.name : '' })).filter(t => t.number);
  const rankings = list(data.rankings, 'rankings').flatMap(r => {
    const members = r.alliance?.teams;
    if (!Array.isArray(members) || members.length !== 1 || !number(members[0].number) || !positive(r.rank)) return [];
    return [{ number: number(members[0].number), rank: r.rank, w: r.wins, l: r.losses, t: r.ties, wp: r.wp, ap: r.ap, sp: r.sp }];
  });
  const skills = list(data.skills, 'skills').flatMap(r => !number(r.number) || !positive(r.rank) || ![r.totalScore, r.driverHighScore, r.progHighScore].every(integer) ? [] : [{ number: number(r.number), rank: r.rank, total: r.totalScore, driver: r.driverHighScore, programming: r.progHighScore, driverAttempts: r.driverAttempts, programmingAttempts: r.progAttempts }]);
  const rawMatches = list(data.matches, 'matches');
  const sessions = [...new Set(rawMatches.map(m => m.matchInfo?.matchTuple?.session).filter(integer))].sort((a,b) => a-b);
  const selectedSession = session ?? (sessions.length === 1 ? sessions[0] : null);
  const candidates = rawMatches.flatMap(m => {
    const info = m.matchInfo, tuple = info?.matchTuple;
    const identity = tmMatchIdentity(tuple);
    if (!identity || tuple.session !== selectedSession) return [];
    if (['r16', 'qf', 'sf'].includes(identity.phase) && rawMatches.some(other => {
      const t = other.matchInfo?.matchTuple;
      return t?.session === tuple.session && t.division === tuple.division && t.round === tuple.round && t.instance === tuple.instance && t.match > 1;
    })) return [];
    const alliances = info.alliances;
    if (!Array.isArray(alliances) || alliances.length !== 2) return [];
    const red = (alliances[0].teams || []).map(t => number(t.number));
    const blue = (alliances[1].teams || []).map(t => number(t.number));
    if (red.length !== 2 || blue.length !== 2 || [...red, ...blue].some(t => !t) || new Set([...red,...blue]).size !== 4) return [];
    const row = { ...identity, red, blue };
    if (info.state === 'SCORED' && Array.isArray(m.finalScore) && m.finalScore.length === 2 && m.finalScore.every(integer)) {
      row.redScore = m.finalScore[0]; row.blueScore = m.finalScore[1];
    }
    return [row];
  });
  const counts = new Map();
  for (const row of candidates) { const key = `${row.phase}:${row.num}`; counts.set(key, (counts.get(key) || 0) + 1); }
  // Only genuinely duplicate pairing/game identities are ambiguous.
  const matches = candidates.filter(row => counts.get(`${row.phase}:${row.num}`) === 1);
  if (rawMatches.length - matches.length) warnings.push(`${rawMatches.length - matches.length} matches outside the selected session or with invalid identities, duplicate pairings, or multi-game non-final series were skipped.`);
  if (rankings.length !== data.rankings.length) warnings.push('Unsupported qualification ranking rows were skipped.');
  if (skills.length !== data.skills.length) warnings.push('Invalid skills rows were skipped.');
  if (teams.length !== data.teams.length) warnings.push('Invalid team rows were skipped.');
  for (const [name, rows] of Object.entries({ teams, rankings, skills })) {
    if (new Set(rows.map(r => r.number)).size !== rows.length) throw Error(`TM returned duplicate ${name} rows. Existing data is kept.`);
  }
  return { event: data.event, teams, rankings, skills, matches, scores: matches.filter(m => m.redScore != null), sessions, selectedSession, warnings };
}
