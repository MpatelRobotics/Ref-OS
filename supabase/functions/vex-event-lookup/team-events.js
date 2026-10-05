const BASE='https://events.vex.com/api/v2/';
export async function lookupTeamEvents(number,token,fetcher=fetch,now=new Date()) {
 number=String(number||'').trim().toUpperCase();
 if(!/^[A-Z0-9-]{1,20}$/.test(number))throw new Error('VEX team number is invalid.');
 if(!token)throw new Error('VEX team events are not configured.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 const start=new Date(now);start.setUTCFullYear(start.getUTCFullYear()-1);
 const end=new Date(now);end.setUTCFullYear(end.getUTCFullYear()+1);
 const get=async(path,params)=>{const url=new URL(path,BASE);for(const [key,value] of Object.entries(params))url.searchParams.set(key,String(value));const response=await fetcher(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:controller.signal,redirect:'error'});if(!response.ok)throw new Error('Could not retrieve VEX team events. Try again later.');return response.json();};
 const pages=async(path,params)=>{const rows=[];for(let page=1;page<=20;page++){const data=await get(path,{...params,page,per_page:250});const last=Number(data.meta?.last_page);if(!Array.isArray(data.data)||!Number.isInteger(last)||last<page||last>20)throw new Error('VEX team event list is incomplete. Try again later.');rows.push(...data.data);if(page===last)return rows;}throw new Error('VEX team event list is too large.');};
 try {
  const teams=(await pages('teams',{'number[]':number})).filter(team=>String(team.number).toUpperCase()===number);
  if(teams.length!==1||!Number.isSafeInteger(teams[0].id))throw new Error('No unique VEX team found for this number.');
  const rows=await pages(`teams/${teams[0].id}/events`,{start:start.toISOString(),end:end.toISOString()});
  const events=[...new Map(rows.filter(row=>Number.isSafeInteger(row.id)).map(row=>[row.id,{id:row.id,code:String(row.sku||''),name:String(row.name||''),start:row.start||null,end:row.end||null,location:[row.location?.venue,row.location?.city,row.location?.region,row.location?.country].filter(v=>typeof v==='string'&&v).join(', '),url:/^(RE-V5RC|VE-V5)-/.test(String(row.sku)) ? `https://events.vex.com/robot-competitions/vex-robotics-competition/${encodeURIComponent(row.sku)}.html` : null}])).values()];
  return {number,events,checkedAt:now.toISOString(),from:start.toISOString(),to:end.toISOString()};
 }finally{clearTimeout(timer);}
}

