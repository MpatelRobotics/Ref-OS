import {US_STATES} from './refereeLocations.js';
const codes='AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const knownStates={'5622fbc3-1baa-43d1-9ff6-f45f34e2c277':'CO','719885f0-0f4d-4d21-983b-c28ec3a95d51':'TN'};
const knownNJ=new Set(['11111111-1111-4111-8111-111111111111','dd6da58d-bbb2-49e9-ad76-8141ac32edb5','0fc62358-dadb-4a12-9eb1-3bd3a6775a54','4f6d3058-f6b9-4c6e-a4e4-0c75af5b5619','5526ae63-37cd-46f5-989a-8ee28789cf8b']);
export function eventState(event){
 const parts=String(event.location||'').split(',').map(x=>x.trim());
 const value=String(event.state||'').trim();
 const index=US_STATES.findIndex((name,i)=>[value,...parts].some(part=>part.toLowerCase()===name.toLowerCase()||part.toUpperCase()===codes[i]));
 return index>=0?codes[index]:knownStates[event.id]||(knownNJ.has(event.id)?'NJ':'');
}
export function groupEventsByState(events){
 const groups=new Map();
 for(const event of events){const state=eventState(event);if(!groups.has(state))groups.set(state,[]);groups.get(state).push(event);}
 return [...groups].sort(([a],[b])=>!a?-1:!b?1:US_STATES[codes.indexOf(a)].localeCompare(US_STATES[codes.indexOf(b)])).map(([state,events])=>({name:state?state+' Events':'',events}));
}
