export const divisionName = value => String(value||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
export function matchTmDivision(remote, local, selectedId, saved={}) {
 const selected=local.find(d=>Number(d.id)===Number(selectedId));
 if(local.length<=1&&!selectedId&&remote.length===1)return {id:remote[0].id,reason:'Only division'};
 if(!selected)return null;
 const remembered=remote.find(d=>Number(d.id)===Number(saved[selectedId]?.id)&&divisionName(d.name)===divisionName(saved[selectedId]?.name));
 if(remembered)return {id:remembered.id,reason:'Saved mapping'};
 const name=divisionName(selected.name);
 const matches=remote.filter(d=>divisionName(d.name)===name);
 return name&&matches.length===1&&local.filter(d=>divisionName(d.name)===name).length===1?{id:matches[0].id,reason:'Matched by name'}:null;
}
