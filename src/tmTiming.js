import { tmMatchIdentity } from './tmMatchIdentity.js';
const valid = n => Number.isFinite(n) && n > 0;
export function mergeTmTiming(previous, activity, matches = [], now = Date.now()) {
  const rows = new Map((previous?.timing || []).map(row => [row.key, {...row}]));
  for (const set of activity.fieldSets || []) for (const field of set.fields || []) {
    const runs = [...(field.timingHistory || [])];
    if (field.match && valid(field.startedAt)) runs.push({match:field.match,assignedAt:field.assignedAt,startedAt:field.startedAt,stoppedAt:field.stoppedAt});
    for (const run of runs) {
      const identity = tmMatchIdentity(run.match);
      if (!identity || !valid(run.startedAt)) continue;
      const key = `${set.id}:${field.id}:${run.match.division}:${run.match.session}:${identity.phase}:${identity.num}:${run.startedAt}`;
      const prior = rows.get(key) || {};
      rows.set(key, {...prior,key,...identity,field:field.name || String(field.id),fieldKey:`${set.id}:${field.id}`,startedAt:run.startedAt,
        assignedAt:valid(run.assignedAt) && run.assignedAt <= run.startedAt ? run.assignedAt : prior.assignedAt || null,
        stoppedAt:valid(run.stoppedAt) && run.stoppedAt >= run.startedAt ? run.stoppedAt : prior.stoppedAt || null});
    }
  }
  const ordered = [...rows.values()].sort((a,b)=>a.startedAt-b.startedAt);
  for (const row of ordered) {
    const match = matches.find(m => (m.phase || 'qual') === row.phase && Number(m.num) === row.num);
    // Only results first observed after the stop are useful for estimating scoring time.
    const signature = match?.redScore != null && match?.blueScore != null ? `${match.redScore}:${match.blueScore}` : null;
    if (!row.stoppedAt && !Object.hasOwn(row,'scoreBeforeStop')) row.scoreBeforeStop = signature;
    if (!row.scoreObservedAt && row.stoppedAt && Object.hasOwn(row,'scoreBeforeStop') && signature != null && signature !== row.scoreBeforeStop && now >= row.stoppedAt) row.scoreObservedAt = now;
  }
  return ordered.slice(-2000);
}
export function timingMetrics(rows, times = [], matches = []) {
  return rows.map(row => {
    const match = matches.find(m => (m.phase || 'qual') === row.phase && Number(m.num) === row.num);
    const same = (a,b) => [...(a || [])].sort().join('|') === [...(b || [])].sort().join('|');
    const scheduled = times.find(t => (t.phase || 'qual') === row.phase && Number(t.num) === row.num && match && same(t.red,match.red) && same(t.blue,match.blue));
    const planned = Date.parse(scheduled?.scheduledAt);
    const next = rows.filter(r => r.fieldKey === row.fieldKey && r.startedAt > row.startedAt).sort((a,b)=>a.startedAt-b.startedAt)[0];
    const scoringEnd = row.scoreObservedAt && (!next || row.scoreObservedAt <= next.startedAt) ? row.scoreObservedAt : null;
    return {...row,delayMs:Number.isFinite(planned)?row.startedAt-planned:null,
      setupMs:row.assignedAt?row.startedAt-row.assignedAt:null,
      playMs:row.stoppedAt?row.stoppedAt-row.startedAt:null,
      scoringMs:row.stoppedAt && scoringEnd?scoringEnd-row.stoppedAt:null,
      turnoverMs:scoringEnd && next?next.startedAt-scoringEnd:null,
      cycleMs:next?next.startedAt-row.startedAt:null};
  });
}
