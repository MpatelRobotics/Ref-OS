const BASE='https://events.vex.com/api/v2/';
export function mapVexMatches(rows, warnings = null) {
 const seen=new Set();return rows.map(row=>{
  const round=Number(row.round);
  const phase=({1:'practice',2:'qual',3:'qf',4:'sf',5:'final',6:'r16'})[round];
  const num=Number([3,4,6].includes(round)?row.instance:row.matchnum);
  if(!phase||!Number.isInteger(num)||num<1||([3,4,6].includes(round)&&Number(row.matchnum)>1)) {
   if(warnings) { warnings.push(`Skipped match: round ${String(row.round)}, instance ${String(row.instance)}, match number ${String(row.matchnum)}. This format requires Tournament Manager import.`); return null; }
   throw new Error('VEX match format is not supported. Use Tournament Manager import for this division.');
  }
  const key=phase+'-'+num;if(seen.has(key))throw new Error('VEX matches have overlapping round numbers. Use Tournament Manager import.');seen.add(key);
  const red=row.alliances?.find(a=>a.color==='red'),blue=row.alliances?.find(a=>a.color==='blue');
  const teams=alliance=>(alliance?.teams||[]).filter(t=>!t.sitting).map(t=>String(t.team?.name||'').trim().toUpperCase());
  const r=teams(red),b=teams(blue);
  if(!r.length||!b.length||[...r,...b].some(t=>!t||!/^[A-Z0-9-]+$/.test(t)))throw new Error('VEX returned incomplete match teams. Try again later.');
  const scored=row.scored===true;
  if(scored&&(!Number.isFinite(red?.score)||!Number.isFinite(blue?.score)))throw new Error('VEX returned incomplete scores. Try again later.');
  return {phase,num,red:r,blue:b,field:String(row.field||''),label:String(row.name||''),scored,redScore:scored?red.score:null,blueScore:scored?blue.score:null,winner:scored?(red.score>blue.score?'red':blue.score>red.score?'blue':''):''};
 }).filter(Boolean);
}
export async function fetchVexMatches(code, division, token, fetcher=fetch, kind='matches') {
 if(!token)throw new Error('VEX match sync is not configured. Contact the developer.');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
 const get=async(path,params={})=>{const url=new URL(path,BASE);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,String(v)));const res=await fetcher(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:controller.signal,redirect:'error'});if(!res.ok)throw new Error('Could not retrieve VEX matches. Try again later.');return res.json();};
 try {
  const events=await get('events',{'sku[]':code});const found=events.data?.filter(e=>e.sku?.toUpperCase()===code);
  if(found?.length!==1||!Number.isSafeInteger(found[0].id))throw new Error('No unique event found for that code.');
  const event=await get('events/'+found[0].id);
  const divisions=(event.divisions||[]).filter(d=>Number.isSafeInteger(d.id)).map(d=>({id:d.id,name:String(d.name||'Division '+d.id)}));
  if(!division)return {code,divisions,matches:[]};
  if(!divisions.some(d=>d.id===Number(division)))throw new Error('VEX division is not available for this event.');
  if(!['matches','rankings','skills'].includes(kind))throw new Error('VEX sync category is not supported.');
  const rows=[];
  for(let page=1;page<=20;page++){const result=await get(kind==='skills'?`events/${found[0].id}/skills`:`events/${found[0].id}/divisions/${Number(division)}/${kind}`,{page,per_page:250});const last=Number(result.meta?.last_page);if(!Array.isArray(result.data)||!Number.isInteger(last)||last<page||last>20)throw new Error('VEX match pagination is incomplete. No matches were imported.');rows.push(...result.data);if(page===last)break;}
  const warnings=[];
  return {code,divisions,kind,matches:kind==='matches'?mapVexMatches(rows,warnings):[],warnings,upstreamRows:rows.length,rankings:kind==='rankings'?mapVexRankings(rows):[],skills:kind==='skills'?mapVexSkills(rows):[],checkedAt:new Date().toISOString()};
 }finally{clearTimeout(timer);}
}

export function mapVexRankings(rows) {
 const seen=new Set();return rows.map(row=>{
 const number=String(row.team?.name||'').trim().toUpperCase();
 if(!/^[A-Z0-9-]+$/.test(number)||!Number.isInteger(row.rank)||row.rank<1||seen.has(number))throw new Error('VEX returned incomplete or duplicate rankings.');seen.add(number);
 return {number,rank:row.rank,w:row.wins??null,l:row.losses??null,t:row.ties??null,wp:row.wp??null,ap:row.ap??null,sp:row.sp??null};
 });
}
export function mapVexSkills(rows) {
 const teams=new Map();for(const row of rows){
 if(!['driver','programming'].includes(row.type))throw new Error('VEX Skills format is not supported for this event.');
 const number=String(row.team?.name||'').trim().toUpperCase();
 if(!/^[A-Z0-9-]+$/.test(number)||!Number.isFinite(row.score)||row.score<0)throw new Error('VEX returned incomplete Skills scores.');
 const previous=teams.get(number)||{number,driver:null,programming:null,rank:null};previous[row.type]=Math.max(previous[row.type]??0,row.score);teams.set(number,previous);
 }
 return [...teams.values()].map(row=>({...row,total:(row.driver??0)+(row.programming??0)})).sort((a,b)=>b.total-a.total||a.number.localeCompare(b.number,'en',{numeric:true}));
}
