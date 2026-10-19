import {refereeAttendanceRecords,localToday} from './refereeCalendar.js';
import {refereeProgram} from './refereeEventFilters.js';
export function refereeService(events,plans,external,year=null,today=localToday()){
 const all=refereeAttendanceRecords(events,plans,external).filter(event=>event.attendance==='attended');
 const days=new Set(),rows=[];let undated=0;
 for(const event of all){if(!event.startDate){undated++;continue;}const end=event.endDate&&event.endDate>=event.startDate?event.endDate:event.startDate;
 const start=new Date(event.startDate+'T00:00:00Z'),last=new Date((end<today?end:today)+'T00:00:00Z');let count=0;
 // Ignore implausibly long date ranges instead of inflating service totals.
 if((last-start)/86400000>366){undated++;continue;}
 for(let date=new Date(start);date<=last;date.setUTCDate(date.getUTCDate()+1)){const day=date.toISOString().slice(0,10);if(year!==null&&day.slice(0,4)!==String(year))continue;days.add(day);count++;}
 if(count)rows.push({...event,days:count,program:refereeProgram(event)});
 }
 return {days:days.size,eventCount:rows.length,rows,undated};
}
const csv=value=>{const text=String(value??'');return '"'+(/^[=+@\-\t\r]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';};
export function serviceSummaryCsv(summary,year,name){return [['Ref OS volunteer service summary',String(year)],['Name',name||'Referee'],['Unique volunteer days',summary.days],['Events attended',summary.eventCount],['Self-reported; full event date ranges. Overlapping dates counted once.'],[],['Event','Code','Start date','End date','Program','Days in year'],...summary.rows.map(row=>[row.name,row.code||'',row.startDate,row.endDate||row.startDate,row.program,row.days])].map(row=>row.map(csv).join(',')).join('\r\n')+'\r\n';}
export function downloadServiceSummary(summary,year,name){const url=URL.createObjectURL(new Blob(['\uFEFF'+serviceSummaryCsv(summary,year,name)],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`Ref-OS-Service-${year}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
