const key=name=>String(name).trim().toLowerCase();
export function assignConflictFreeGroups(teams,names,conflicts={}){
 const allowed=new Map(teams.map(team=>[team,names.filter(name=>!(conflicts[key(name)]||[]).includes(team))]));
 const groups=names.map(name=>({name,teams:[]}));const assignment=new Map();let capacity=Math.ceil(teams.length/names.length);
 const move=(team,name)=>{const prior=assignment.get(team);if(prior)groups.find(g=>g.name===prior).teams=groups.find(g=>g.name===prior).teams.filter(t=>t!==team);groups.find(g=>g.name===name).teams.push(team);assignment.set(team,name);};
 const place=(team,seen=new Set())=>{for(const g of [...groups].sort((a,b)=>a.teams.length-b.teams.length).filter(g=>allowed.get(team).includes(g.name))){if(seen.has(g.name))continue;seen.add(g.name);if(g.teams.length<capacity){move(team,g.name);return true;}for(const other of [...g.teams])if(place(other,seen)){move(team,g.name);return true;}}return false;};
 const order=[...teams].sort((a,b)=>allowed.get(a).length-allowed.get(b).length||a.localeCompare(b,undefined,{numeric:true}));const pending=order.filter(team=>!place(team));capacity=teams.length;const unassigned=pending.filter(team=>!place(team));
 const floor=Math.floor((teams.length-unassigned.length)/names.length);
 const fill=(name,seen=new Set([name]))=>{for(const team of teams){const from=assignment.get(team);if(!from||from===name||seen.has(from)||!allowed.get(team).includes(name))continue;seen.add(from);if(groups.find(g=>g.name===from).teams.length>floor||fill(from,seen)){move(team,name);return true;}}return false;};
 for(const g of groups)while(g.teams.length<floor&&fill(g.name)){}
 return {groups,unassigned,uneven:Math.max(...groups.map(g=>g.teams.length))-Math.min(...groups.map(g=>g.teams.length))>1};
}
