const BASE = 'https://events.vex.com/api/v2/';
export function normalizeCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!/^(?:RE|VE)-[A-Z0-9]{2,12}-\d{2}-\d{3,8}$/.test(code)) throw new Error('Enter a full VEX event code, for example RE-V5RC-26-4270 or VE-V5-27-65868.');
  return code;
}
const typeName = value => typeof value === 'string' ? value : value?.name || '';
const eventType = value => /league/i.test(typeName(value)) ? 'league' : /tournament/i.test(typeName(value)) ? 'tournament' : '';
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
      program: text(event.program?.name), eventType: eventType(event.event_type),
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
  const stateNames='Alabama|AL,Alaska|AK,Arizona|AZ,Arkansas|AR,California|CA,Colorado|CO,Connecticut|CT,Delaware|DE,District of Columbia|DC,Florida|FL,Georgia|GA,Hawaii|HI,Idaho|ID,Illinois|IL,Indiana|IN,Iowa|IA,Kansas|KS,Kentucky|KY,Louisiana|LA,Maine|ME,Maryland|MD,Massachusetts|MA,Michigan|MI,Minnesota|MN,Mississippi|MS,Missouri|MO,Montana|MT,Nebraska|NE,Nevada|NV,New Hampshire|NH,New Jersey|NJ,New Mexico|NM,New York|NY,North Carolina|NC,North Dakota|ND,Ohio|OH,Oklahoma|OK,Oregon|OR,Pennsylvania|PA,Rhode Island|RI,South Carolina|SC,South Dakota|SD,Tennessee|TN,Texas|TX,Utah|UT,Vermont|VT,Virginia|VA,Washington|WA,West Virginia|WV,Wisconsin|WI,Wyoming|WY,Puerto Rico|PR,Guam|GU,US Virgin Islands|VI';
  const pair=stateNames.split(',').map(v=>v.split('|')).find(pair=>pair.some(v=>normalized(v)===normalized(state)));
  if(!pair)throw new Error('Enter a valid US state or territory.');
  const stateAliases=new Set(pair.map(normalized));
  const locationValue=value=>typeof value==='string'?value:value?.name||value?.code||'';
  const controller = new AbortController(); const timer=setTimeout(()=>controller.abort(),25000);
  const events=[];let nextPage=null;
  try {
    for(let current=page;current<page+5;current++) {
      const url=new URL('events',BASE);
      url.searchParams.set('start',start+'T00:00:00Z');url.searchParams.set('end',end+'T23:59:59Z');url.searchParams.set('per_page','250');url.searchParams.set('page',String(current));
      // Retrieve the date window and filter locally; region query behavior differs across API versions.
      const res=await fetcher(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:controller.signal,redirect:'error'});
      if(!res.ok)throw new Error('Could not retrieve VEX events. Try again later.');
      const body=await res.json();const last=Number(body.meta?.last_page);
      if(!Array.isArray(body.data)||!Number.isInteger(last)||last<current||last>500)throw new Error('VEX returned incomplete event search results.');
      for(const event of body.data) {
        const locations=[event.location,...(Array.isArray(event.locations)?event.locations:[])].filter(Boolean);
        if(!locations.some(location=>accepted.has(normalized(locationValue(location.country))) && stateAliases.has(normalized(locationValue(location.region)))))continue;
        if(typeName(event.event_type) && !eventType(event.event_type))continue;
        if(!text(event.name)||!text(event.sku))continue;
        events.push({code:text(event.sku),name:text(event.name),start:text(event.start),city:text(event.location?.city),eventType:eventType(event.event_type)});
      }
      if(current===last){nextPage=null;break;}
      nextPage=current+1;
      if(events.length>=50)break;
    }
    return {events:events.sort((a,b)=>a.start.localeCompare(b.start)||a.name.localeCompare(b.name)),nextPage};
  } finally {clearTimeout(timer);}
}
