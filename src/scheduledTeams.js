// Presentation only: preserve every original team record and its data.
export function partitionScheduledTeams(teams, matches, enabled) {
 const numbers = new Set(Object.values(matches || {}).flatMap(m => [...(m.red || []), ...(m.blue || []), ...(m.teams || [])]).map(n => String(n).trim().toUpperCase()).filter(Boolean));
 if (!enabled || !numbers.size) return { scheduled: teams, unscheduled: [] };
 return { scheduled: teams.filter(t => numbers.has(String(t.number).trim().toUpperCase())), unscheduled: teams.filter(t => !numbers.has(String(t.number).trim().toUpperCase())) };
}
