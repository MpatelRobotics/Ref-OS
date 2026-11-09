import lookupTimezone from './timezoneLookup.js';
import {WORLD_GEOGRAPHY} from './worldGeography.js';
const valid=zone=>{if(typeof zone!=='string'||zone.length>100||!(zone==='UTC'||zone==='GMT'||zone.includes('/')))return null;try{new Intl.DateTimeFormat('en',{timeZone:zone});return zone;}catch{return null;}};
const fold=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
const field=value=>typeof value==='string'?value:value?.code||value?.name||'';
const names=new Intl.DisplayNames(['en'],{type:'region'});
const coordinate=value=>typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):NaN;
export function detectVexTimezone(event) {
 const location=event.location||{};
 for(const value of [event.timezone,event.time_zone,event.timeZone,location.timezone,location.time_zone]){
  const timezone=valid(field(value));if(timezone)return {timezone,timezoneSource:'VEX event'};
 }
 const lat=coordinate(location.coordinates?.lat??location.coordinates?.latitude??location.latitude);
 const lon=coordinate(location.coordinates?.lon??location.coordinates?.lng??location.coordinates?.longitude??location.longitude);
 if(Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&(lat!==0||lon!==0)){
  try{const timezone=valid(lookupTimezone(lat,lon));if(timezone)return {timezone,timezoneSource:'Venue coordinates'};}catch{/* Continue to unambiguous country data. */}
 }
 const aliases={usa:'US',unitedstatesofamerica:'US',uk:'GB',greatbritain:'GB'};
 const country=fold(field(location.country));
 const entry=country&&WORLD_GEOGRAPHY.find(c=>[c.code,c.name,names.of(c.code)].some(name=>fold(name)===country)||c.code===aliases[country]);
 if(entry){
  const canonical=[...new Set(entry.zones.map(zone=>{try{return new Intl.DateTimeFormat('en',{timeZone:zone}).resolvedOptions().timeZone;}catch{return null;}}).filter(Boolean))];
  if(canonical.length===1)return {timezone:canonical[0],timezoneSource:'Event country'};
 }
 return {timezone:null,timezoneSource:null};
}
