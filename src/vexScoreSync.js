const sameTeams=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&[...a].sort().join('|')===[...b].sort().join('|');
export function planScoreUpdates(matches,scores){
 const counts=new Map();for(const row of scores)counts.set(`${row.phase}:${row.num}`,(counts.get(`${row.phase}:${row.num}`)||0)+1);
 const updates=[];let skipped=0;
 for(const row of scores){
  const candidates=Object.values(matches).filter(m=>m.phase===row.phase&&Number(m.num)===Number(row.num));
  const existing=candidates[0];
  if(counts.get(`${row.phase}:${row.num}`)!==1||candidates.length!==1||!sameTeams(existing.red,row.red)||!sameTeams(existing.blue,row.blue)){skipped++;continue;}
  if(existing.redScore===row.redScore&&existing.blueScore===row.blueScore)continue;
  updates.push({existing,...row});
 }
 return {updates,skipped};
}

// Insert only unambiguous, complete schedules. Existing assignments are never replaced.
export function planMissingVexMatches(matches, rows) {
 const existing = new Set(Object.values(matches).map(m => `${m.phase}:${m.num}`));
 const counts = new Map();
 for (const row of rows) counts.set(`${row.phase}:${row.num}`, (counts.get(`${row.phase}:${row.num}`) || 0) + 1);
 return rows.filter(row => !existing.has(`${row.phase}:${row.num}`) && counts.get(`${row.phase}:${row.num}`) === 1
  && ['practice','qual','r16','qf','sf','final'].includes(row.phase) && Number.isInteger(row.num) && row.num > 0
  && Array.isArray(row.red) && Array.isArray(row.blue) && row.red.length === 2 && row.blue.length === 2
  && new Set([...row.red,...row.blue]).size === 4 && [...row.red,...row.blue].every(n => /^[A-Z0-9-]+$/.test(n)));
}

export function planVexRosterUpdates(existing, roster){
 const known=new Map(existing.map(t=>[t.number,t]));
 return roster.filter(t=>!known.has(t.number)||(t.name&&t.name!==known.get(t.number).name))
  .map(t=>({number:t.number,name:t.name||known.get(t.number)?.name||''}));
}
