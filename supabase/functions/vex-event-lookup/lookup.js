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
