import {tmMatchOrder,tmPairingNumber} from './tmMatchIdentity.js';
const phases=['r16','qf','sf','final'];
const same=(a,b)=>JSON.stringify(a||[])===JSON.stringify(b||[]);
export const bracketSnapshot=matches=>Object.values(matches).filter(m=>phases.includes(m.phase)).map(m=>({phase:m.phase,num:Number(m.num),red:m.red||[],blue:m.blue||[],winner:m.winner||null,redScore:m.redScore??null,blueScore:m.blueScore??null,field:m.field||null,label:m.label||null})).sort((a,b)=>a.phase.localeCompare(b.phase)||a.num-b.num);
export function planBracketCorrection(matches,source,winner,finalsBestOf=1){
 const map=Object.fromEntries(Object.entries(matches).map(([id,m])=>[id,{...m}]));
 if(!phases.includes(source.phase)||!map[source.id])throw Error('Elimination match not found. Refresh the bracket.');
 const changes=[{action:'upsert',...bracketSnapshot({[source.id]:{...source,winner}})[0]}];
 map[source.id]={...source,winner};
 const games=(phase,num)=>Object.values(map).filter(m=>m.phase===phase&&(phase==='final'||tmPairingNumber(phase,m.num)===num)).sort(tmMatchOrder);
 const won=(phase,num)=>{const m=games(phase,num).at(-1);return m&&['red','blue'].includes(m.winner)?m[m.winner]:null;};
 let index=phases.indexOf(source.phase),pair=tmPairingNumber(source.phase,source.num),invalidated=0;
 while(index<phases.length-1){
  const prior=phases[index],next=phases[++index];pair=Math.ceil(pair/2);
  const red=won(prior,pair*2-1),blue=won(prior,pair*2),existing=games(next,pair);
  if(!red?.length||!blue?.length){
   for(const m of existing){changes.push({action:'delete',phase:m.phase,num:m.num});delete map[m.id];if(m.winner||m.redScore!=null||m.blueScore!=null)invalidated++;}
  }else if(!existing.length||existing.some(m=>!same(m.red,red)||!same(m.blue,blue))){
   const count=next==='final'&&Number(finalsBestOf)===3?3:1;
   const retained=new Set(Array.from({length:count},(_,i)=>next==='final'?i+1:pair));
   for(const m of existing){if(!retained.has(Number(m.num)))changes.push({action:'delete',phase:m.phase,num:m.num});delete map[m.id];if(m.winner||m.redScore!=null||m.blueScore!=null)invalidated++;}
   for(let g=1;g<=count;g++){
    const num=next==='final'?g:pair,old=existing.find(m=>m.num===num);
    const m={phase:next,num,red,blue,winner:null,redScore:null,blueScore:null,field:old?.field||null,label:old?.label||`${next.toUpperCase()} ${num}`};
    changes.push({action:'upsert',...m});map[`${next}-${num}`]={id:`${next}-${num}`,...m};
   }
  }
 }
 return {expected:bracketSnapshot(matches),changes,invalidated};
}
