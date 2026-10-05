const BASE = 'https://events.vex.com/api/v2/';
export function normalizeCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!/^RE-[A-Z0-9]{2,12}-\d{2}-\d{3,8}$/.test(code)) throw new Error('Enter a full VEX event code, for example RE-V5RC-26-4270.');
  return code;
}
const text = value => typeof value === 'string' ? value.trim().slice(0, 300) : '';
export async function lookupEvent(code, token, fetcher = fetch) {
  code = normalizeCode(code);
  if (!token) throw new Error('VEX event lookup is not configured yet. Contact the app developer.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  const get = async (path, params = {}) => {
    const url = new URL(path, BASE);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    const response = await fetcher(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: controller.signal, redirect: 'error' });
    if (!response.ok) throw new Error(response.status === 429 ? 'VEX API is busy. Try again in a minute.' : 'Could not retrieve VEX event information. Check the server token and try again.');
    const body = await response.json();
    if (!Array.isArray(body.data)) throw new Error('VEX returned an unexpected response. Try again later.');
    return body;
  };
  try {
    const result = await get('events', { 'sku[]': code, per_page: 250 });
    const found = result.data.filter(event => text(event.sku).toUpperCase() === code);
    if (found.length !== 1) throw new Error('No unique event found for that code. Check the full event code.');
    const event = found[0];
    if (!Number.isSafeInteger(event.id) || event.id < 1 || !text(event.name)) throw new Error('VEX returned incomplete event details.');
    const teams = new Map();
    for (let page = 1; ; page++) {
      const list = await get(`events/${event.id}/teams`, { page, per_page: 250 });
      for (const team of list.data) {
        const number = text(team.number).toUpperCase();
        if (!number || !/^[A-Z0-9-]+$/.test(number)) throw new Error('VEX returned an invalid team number. No roster was imported.');
        teams.set(number, { number, name: text(team.team_name) });
      }
      const last = Number(list.meta?.last_page);
      if (!Number.isInteger(last) || last < page || last > 20) throw new Error('VEX roster pagination is incomplete or exceeds the supported size. No roster was imported.');
      if (page === last) break;
    }
    const location = event.location || {};
    return { code, name: text(event.name), start: text(event.start), end: text(event.end),
      location: ['venue','address_1','address_2','city','region','postcode','country'].map(key => text(location[key])).filter(Boolean).join(', '),
      program: text(event.program?.name), eventType: text(event.event_type),
      teams: [...teams.values()].sort((a,b) => a.number.localeCompare(b.number,'en',{numeric:true})) };
  } finally { clearTimeout(timer); }
}

const normalized = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
export async function searchEvents(filters, token, fetcher = fetch) {
  const country = String(filters.country || '').toUpperCase();
  const state = String(filters.state || '').trim();
  const page = Number(filters.page || 1);
  const start = String(filters.start || ''), end = String(filters.end || '');
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
  if (country !== 'US' || !date(start) || !date(end) || end < start || (Date.parse(end)-Date.parse(start)) > 366*86400000 || !Number.isInteger(page) || page<1 || page>500 || (country==='US' && (!state || state.length>50))) throw new Error('Enter a country, US state where needed, and a date range of up to one year.');
  if (!token) throw new Error('VEX event lookup is not configured yet. Contact the app developer.');
  const name = new Intl.DisplayNames(['en'],{type:'region'}).of(country);
  if (!name || name===country) throw new Error('Enter a valid country.');
  const accepted = new Set([normalized(name),normalized(country)]);
  if(country==='US') ['United States of America','USA'].forEach(v=>accepted.add(normalized(v)));
  if(country==='GB') ['UK','Great Britain'].forEach(v=>accepted.add(normalized(v)));
  const controller = new AbortController(); const timer=setTimeout(()=>controller.abort(),25000);
  const events=[];let nextPage=null;
  try {
    for(let current=page;current<page+5;current++) {
      const url=new URL('events',BASE);
      url.searchParams.set('start',start+'T00:00:00Z');url.searchParams.set('end',end+'T23:59:59Z');url.searchParams.set('per_page','250');url.searchParams.set('page',String(current));
      if(country==='US')url.searchParams.set('region',state);
      const res=await fetcher(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:controller.signal,redirect:'error'});
      if(!res.ok)throw new Error('Could not retrieve VEX events. Try again later.');
      const body=await res.json();const last=Number(body.meta?.last_page);
      if(!Array.isArray(body.data)||!Number.isInteger(last)||last<current||last>500)throw new Error('VEX returned incomplete event search results.');
      for(const event of body.data) {
        if(!accepted.has(normalized(event.location?.country)))continue;
        if(country==='US'&&normalized(event.location?.region)!==normalized(state))continue;
        if(!['league','tournament'].includes(event.event_type))continue;
        if(!text(event.name)||!text(event.sku))continue;
        events.push({code:text(event.sku),name:text(event.name),start:text(event.start),city:text(event.location?.city),eventType:text(event.event_type)});
      }
      if(current===last){nextPage=null;break;}
      nextPage=current+1;
      if(events.length>=50)break;
    }
    return {events:events.sort((a,b)=>a.start.localeCompare(b.start)||a.name.localeCompare(b.name)),nextPage};
  } finally {clearTimeout(timer);}
}
