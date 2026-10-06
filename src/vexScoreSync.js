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
