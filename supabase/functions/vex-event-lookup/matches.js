const BASE='https://events.vex.com/api/v2/';
export async function fetchVexStandings(code, division, token, fetcher=fetch, kind='rankings') {
 if(!['rankings','skills'].includes(kind))throw new Error('VEX API sync supports only rankings and Skills.');
 if(!token)throw new Error('VEX standings sync is not configured. Contact the developer.');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
 const get=async(path,params={})=>{const url=new URL(path,BASE);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,String(v)));const res=await fetcher(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:controller.signal,redirect:'error'});if(!res.ok)throw new Error('Could not retrieve VEX standingses. Try again later.');return res.json();};
 try {
  const events=await get('events',{'sku[]':code});const found=events.data?.filter(e=>e.sku?.toUpperCase()===code);
  if(found?.length!==1||!Number.isSafeInteger(found[0].id))throw new Error('No unique event found for that code.');
  const event=await get('events/'+found[0].id);
  const divisions=(event.divisions||[]).filter(d=>Number.isSafeInteger(d.id)).map(d=>({id:d.id,name:String(d.name||'Division '+d.id)}));
  if(!division)return {code,divisions,rankings:[],skills:[]};
  if(!divisions.some(d=>d.id===Number(division)))throw new Error('VEX division is not available for this event.');
  if(!['rankings','skills'].includes(kind))throw new Error('VEX sync category is not supported.');
  const rows=[];
  for(let page=1;page<=20;page++){const result=await get(kind==='skills'?`events/${found[0].id}/skills`:`events/${found[0].id}/divisions/${Number(division)}/${kind}`,{page,per_page:250});const last=Number(result.meta?.last_page);if(!Array.isArray(result.data)||!Number.isInteger(last)||last<page||last>20)throw new Error('VEX standings pagination is incomplete. No standings were imported.');rows.push(...result.data);if(page===last)break;}
  const warnings=[];
  return {code,divisions,kind,warnings,upstreamRows:rows.length,rankings:kind==='rankings'?mapVexRankings(rows):[],skills:kind==='skills'?mapVexSkills(rows):[],checkedAt:new Date().toISOString()};
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

