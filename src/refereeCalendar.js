// VEX dates are exported as all-day dates; do not shift them through device timezones.
export function calendarDate(value){const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);if(!match)return '';const iso=match.slice(1).join('-');const date=new Date(iso+'T00:00:00Z');return Number.isNaN(+date)||date.toISOString().slice(0,10)!==iso?'':iso;}
export function localToday(now=new Date()){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
export function upcomingRefereeEvents(events,plans,external,today=localToday()){
 const rows=new Map();
 for(const event of events){const plan=plans.find(p=>p.event_id===event.id);if(plan)rows.set(event.code||event.id,{...event,attendance:plan.attendance});}
 for(const event of external){const linked=events.find(e=>e.code&&e.code===event.code);rows.set(event.code,{...linked,...event,id:linked?.id||event.id,archivedAt:linked?.archivedAt,start_date:event.start_date||event.start||linked?.start_date,end_date:event.end_date||event.end||linked?.end_date});}
 return [...rows.values()].map(event=>({...event,startDate:calendarDate(event.start_date||event.start),endDate:calendarDate(event.end_date||event.end)})).filter(event=>event.attendance==='going'&&!event.archivedAt&&event.startDate&&(event.endDate||event.startDate)>=today).sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.name.localeCompare(b.name));
}
const escape=value=>String(value||'').replaceAll('\\','\\\\').replace(/\r?\n/g,'\\n').replaceAll(';','\\;').replaceAll(',','\\,');
function fold(line){let result='',current='',bytes=0;for(const char of line){const length=new TextEncoder().encode(char).length;if(bytes+length>75){result+=current+'\r\n';current=' ';bytes=1;}current+=char;bytes+=length;}return result+current;}
export function refereeCalendar(events,now=new Date()){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Ref OS//Referee Events//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
 for(const event of events){const start=calendarDate(event.startDate||event.start_date||event.start);if(!start)continue;const end=calendarDate(event.endDate||event.end_date||event.end);const last=end&&end>=start?end:start;const exclusive=new Date(last+'T00:00:00Z');exclusive.setUTCDate(exclusive.getUTCDate()+1);
 lines.push('BEGIN:VEVENT',`UID:${escape(event.code||event.id)}@ref-os.fyi`,`DTSTAMP:${now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}`,`DTSTART;VALUE=DATE:${start.replaceAll('-','')}`,`DTEND;VALUE=DATE:${exclusive.toISOString().slice(0,10).replaceAll('-','')}`,`SUMMARY:${escape(event.name)}`,`LOCATION:${escape(event.location)}`,`DESCRIPTION:${escape('Referee attendance plan'+(event.code?' · '+event.code:'')+'. Self-reported; confirm your assignment with event leadership.')}`,'END:VEVENT');}
 lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
export function downloadRefereeCalendar(events){const url=URL.createObjectURL(new Blob([refereeCalendar(events)],{type:'text/calendar;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='Ref-OS-Upcoming-Events.ics';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
