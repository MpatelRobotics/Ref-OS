const key=name=>String(name).trim().toLowerCase();
export function assignConflictFreeGroups(teams,names,conflicts={},existing=[]){
 const allowed=new Map(teams.map(team=>[team,names.filter(name=>!(conflicts[key(name)]||[]).includes(team))]));
 const groups=names.map(name=>({name,teams:[]}));const assignment=new Map();let capacity=Math.ceil(teams.length/names.length);
 const move=(team,name)=>{const prior=assignment.get(team);if(prior)groups.find(g=>g.name===prior).teams=groups.find(g=>g.name===prior).teams.filter(t=>t!==team);groups.find(g=>g.name===name).teams.push(team);assignment.set(team,name);};
 const place=(team,seen=new Set())=>{for(const g of [...groups].sort((a,b)=>a.teams.length-b.teams.length).filter(g=>allowed.get(team).includes(g.name))){if(seen.has(g.name))continue;seen.add(g.name);if(g.teams.length<capacity){move(team,g.name);return true;}for(const other of [...g.teams])if(place(other,seen)){move(team,g.name);return true;}}return false;};
 const order=[...teams].sort((a,b)=>allowed.get(a).length-allowed.get(b).length||a.localeCompare(b,undefined,{numeric:true}));const pending=order.filter(team=>!place(team));capacity=teams.length;const unassigned=pending.filter(team=>!place(team));
 const floor=Math.floor((teams.length-unassigned.length)/names.length);
 const fill=(name,seen=new Set([name]))=>{for(const team of teams){const from=assignment.get(team);if(!from||from===name||seen.has(from)||!allowed.get(team).includes(name))continue;seen.add(from);if(groups.find(g=>g.name===from).teams.length>floor||fill(from,seen)){move(team,name);return true;}}return false;};
 for(const g of groups)while(g.teams.length<floor&&fill(g.name)){}
 // Team-number prefixes identify sister teams (4610A, 4610B, ...).
 const organization=team=>String(team).match(/^\d+/)?.[0]||String(team);
 const counts=name=>{const result=new Map();for(const team of [...groups.find(g=>g.name===name).teams,...existing.filter(r=>r.group===name).map(r=>r.team)]){const org=organization(team);result.set(org,(result.get(org)||0)+1);}return result;};
 // Swap only when both destinations are eligible and sister-team concentration falls.
 // Group sizes stay unchanged and previously saved interviews stay in place.
 let improved=true;
 while(improved){improved=false;let best=null,bestGain=0;for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){const a=groups[i],b=groups[j],ac=counts(a.name),bc=counts(b.name);for(const x of a.teams)for(const y of b.teams){const ox=organization(x),oy=organization(y);if(ox===oy||!allowed.get(x).includes(b.name)||!allowed.get(y).includes(a.name))continue;const gain=(ac.get(ox)||0)-(ac.get(oy)||0)+(bc.get(oy)||0)-(bc.get(ox)||0)-2;if(gain>bestGain){bestGain=gain;best={x,y,a:a.name,b:b.name};}}}if(best){move(best.x,best.b);move(best.y,best.a);improved=true;}}
 return {groups,unassigned,uneven:Math.max(...groups.map(g=>g.teams.length))-Math.min(...groups.map(g=>g.teams.length))>1};
}
