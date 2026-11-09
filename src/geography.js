import { WORLD_GEOGRAPHY } from '../supabase/functions/_shared/worldGeography.js';
const names = new Intl.DisplayNames(['en'], { type: 'region' });
export const COUNTRIES = WORLD_GEOGRAPHY.map(c=>({...c,name:names.of(c.code)||c.name,keywords:c.name})).sort((a,b)=>a.name.localeCompare(b.name));
const canonical = zone => { try { return new Intl.DateTimeFormat('en',{timeZone:zone}).resolvedOptions().timeZone; } catch { return null; } };
export function timezoneCountry(zone) {
  const key=canonical(zone);
  if(key==='UTC')return 'UTC';
  return COUNTRIES.find(c=>c.zones.includes(zone))?.code || COUNTRIES.find(c=>c.zones.some(z=>canonical(z)===key && key))?.code || '';
}
export function countryTimezones(code, saved='') {
  if(code==='UTC')return ['UTC'];
  const zones=COUNTRIES.find(c=>c.code===code)?.zones||[];
  return [...new Set([...zones,...(saved&&timezoneCountry(saved)===code?[saved]:[])])].filter(z=>canonical(z)).sort();
}
