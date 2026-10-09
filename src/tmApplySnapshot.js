import { planScoreUpdates } from './vexScoreSync.js';

// All writes use the app's authenticated API and selected league session.
export async function applyTmSnapshot(snapshot, { api, eventId, by, includeSchedule, hashes, current }) {
  const changed = (kind, rows) => rows.length && hashes[kind] !== JSON.stringify(rows);
  const remember = (kind, rows) => { hashes[kind] = JSON.stringify(rows); };
  let added = 0, scored = 0, skipped = 0;
  if (!current()) return;
  if (changed('teams', snapshot.teams)) {
    const existing = await api.listTeams(eventId);
    if (!current()) return;
    await api.bulkUpsertTeams(eventId, snapshot.teams.map(row => ({ ...row, name: row.name || existing.find(t => t.number === row.number)?.name || '' })));
    remember('teams', snapshot.teams);
  }
  if (!current()) return;
  // Skills are event-wide, so their teams may be outside the chosen division.
  const known = new Set((await api.listTeams(eventId)).map(t => t.number));
  const missing = [...new Set([...snapshot.rankings, ...snapshot.skills].map(r => r.number))].filter(n => !known.has(n));
  if (!current()) return;
  if (missing.length) await api.bulkUpsertTeams(eventId, missing.map(number => ({ number, name: '' })));
  if (!current()) return;
  let existingMatches = await api.listMatches(eventId, { strict: true });
  if (!current()) return;
  if (includeSchedule && changed('matches', snapshot.matches)) {
    for (const row of snapshot.matches) {
      if (!current()) return;
      if (existingMatches.some(m => m.phase === row.phase && m.num === row.num)) continue;
      // Result application stays separate so scores use matching-team checks.
      if (await api.insertTmMatch(eventId, { phase: row.phase, num: row.num, red: row.red, blue: row.blue })) added++;
    }
    remember('matches', snapshot.matches);
    if (!current()) return;
    existingMatches = await api.listMatches(eventId, { strict: true });
  }
  if (!current()) return;
  const plan = planScoreUpdates(existingMatches, snapshot.scores);
  skipped = plan.skipped;
  for (const row of plan.updates) {
    if (!current()) return;
    const updated = await api.updateExistingVexScore(eventId, row);
    scored += updated; skipped += 1 - updated;
  }
  if (!current()) return;
  if (changed('rankings', snapshot.rankings)) {
    await api.bulkUpsertRankings(eventId, snapshot.rankings);
    if (!current()) return;
    await api.upsertEventSetting(eventId, 'qualification_records', {
      records: Object.fromEntries(snapshot.rankings.map(r => [r.number, { w: r.w, l: r.l, t: r.t, wp: r.wp, ap: r.ap, sp: r.sp }])), importedAt: Date.now(), source: 'TM API',
    }, by);
    remember('rankings', snapshot.rankings);
  }
  if (!current()) return;
  if (changed('skills', snapshot.skills)) {
    await api.upsertEventSetting(eventId, 'skills_rankings', { rows: snapshot.skills, importedAt: Date.now(), source: 'TM API' }, by);
    remember('skills', snapshot.skills);
  }
  return `${added} matches added · ${scored} scores updated · ${snapshot.rankings.length} qualification rankings received · ${skipped} unmatched scores skipped.`;
}
